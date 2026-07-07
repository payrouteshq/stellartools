import "server-only";

import { resolveAuthContext } from "@/actions/apikey";
import { getStoredResponse, saveIdempotencyResult, tryAcquireLock } from "@/actions/idempotency";
import { getCorsHeaders } from "@/constant";
import { AuthContext } from "@/types";
import { AppScope } from "@stellartools/app-sdk/schema";
import { MaybePromise, Result, z as Schema, validateSchema } from "@stellartools/core";
import _ from "lodash";
import { NextRequest, NextResponse } from "next/server";

/**
 * @type {DangerouslyAllowedAppScopes} This type is marked as dangerous because it allows appTokens to write to the db,
 * But it's only used for app installations and we trust the app to not abuse it.
 */
export type DangerouslyAllowedAppScopes = "write:app-installation" | "read:app-installation";

function toSnakeCase(data: any): any {
  if (typeof data === "bigint") return Number(data.toString());
  if (data instanceof Date) return data.toISOString();
  if (data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(toSnakeCase);
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [_.snakeCase(k), toSnakeCase(v)]));
}

export const mcpToolsRegistry = new Map<string, HandlerConfig<any, any, any>>();

export type AuthScope = "session" | "apikey" | "portal" | "app" | "vercelToken";

export type HandlerConfig<TBody, TParams, TQuery> = {
  schema?: {
    body?: Schema.ZodSchema<TBody>;
    params?: Schema.ZodSchema<TParams>;
    query?: Schema.ZodSchema<TQuery>;
  };
  mcp?: { name: string; description: string };
  auth?: Array<AuthScope> | null;
  requiredAppScope?: AppScope | DangerouslyAllowedAppScopes;
  handler: (args: {
    body: TBody;
    params: TParams;
    query: TQuery;
    auth: AuthContext;
    req: NextRequest;
    sessionToken?: string | null;
  }) => MaybePromise<Result<any, Error> | Response>;
  headers?: Record<string, string>;
  convertToSnakeCase?: boolean;
};

export const apiHandler = <TBody = any, TParams = any, TQuery = any>(config: HandlerConfig<TBody, TParams, TQuery>) => {
  if (config.mcp) mcpToolsRegistry.set(config.mcp.name, config);

  return async (req: NextRequest, context: { params: Promise<any> }) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    const idempotencyKey = req.headers.get("Idempotency-Key");

    try {
      // 1. AUTHENTICATION & SCOPING
      const authParams = {
        apiKey: req.headers.get("x-api-key"),
        sessionToken: req.headers.get("x-session-token"),
        portalToken: req.headers.get("x-portal-token"),
        appToken: req.headers.get("x-stellartools-app-token"),
        vercelToken: req.headers.get("authorization"),
      };

      const authResult = await resolveAuthContext(authParams);
      if (config.auth && !authResult) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
      }

      // Permissions check
      if (authResult?.type === "app" && config.requiredAppScope) {
        const allowedScopes = [
          ...(authResult?.scopes ?? []),
          "write:app-installation",
          "read:app-installation", // Automatically allow all app tokens to read app installations
        ] as const;

        const hasPermission = allowedScopes.includes(config.requiredAppScope);

        if (!hasPermission) {
          return NextResponse.json(
            { error: `Forbidden: App missing scope [${config.requiredAppScope}]` },
            { status: 403, headers: corsHeaders }
          );
        }
      }

      // 2. IDEMPOTENCY CHECK (POST ONLY)
      if (idempotencyKey && req.method === "POST" && authResult) {
        const stored = await getStoredResponse(idempotencyKey, authResult.organizationId);

        if (stored) {
          if (stored.lockedAt && !stored.responseStatus) {
            return NextResponse.json({ error: "Request in progress" }, { status: 409, headers: corsHeaders });
          }
          return NextResponse.json(stored.responseBody, { status: stored.responseStatus!, headers: corsHeaders });
        }

        const locked = await tryAcquireLock(idempotencyKey, authResult.organizationId, req.nextUrl.pathname);
        if (!locked) return NextResponse.json({ error: "Conflict" }, { status: 409, headers: corsHeaders });
      }

      // 3. INPUT VALIDATION
      const rawParams = await context.params;
      const { searchParams } = new URL(req.url);
      const rawQuery = Object.fromEntries(searchParams.entries());

      let body = {} as TBody;
      if (config.schema?.body) {
        const json = await req.json().catch(() => ({}));
        const v = validateSchema(config.schema.body, json);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        body = v.value;
      }

      let params = rawParams;
      if (config.schema?.params) {
        const v = validateSchema(config.schema.params, rawParams);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        params = v.value;
      }

      let query = rawQuery as any;
      if (config.schema?.query) {
        const v = validateSchema(config.schema.query, rawQuery);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        query = v.value;
      }

      // 4. HANDLER EXECUTION
      const result = await config.handler({
        body,
        params,
        query,
        auth: authResult!,
        req,
        sessionToken: req.headers.get("x-session-token"),
      });

      // 5. CACHING & RESPONSE
      if (result instanceof Response) {
        // We generally don't cache raw Responses (streams/files) in idempotency jsonb
        return result;
      }

      if (result.isErr()) {
        const errBody = { error: result.error.message };
        if (idempotencyKey && authResult) {
          await saveIdempotencyResult(idempotencyKey, authResult.organizationId, 400, errBody);
        }
        return NextResponse.json(errBody, { status: 400, headers: corsHeaders });
      }

      const processedData = (config.convertToSnakeCase ?? true) ? toSnakeCase(result.value) : result.value;

      if (idempotencyKey && authResult) {
        await saveIdempotencyResult(idempotencyKey, authResult.organizationId, 200, processedData);
      }

      return NextResponse.json(processedData, { headers: { ...corsHeaders, ...config.headers } });
    } catch (error: any) {
      console.error("[API_ERROR]", error);
      return NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500, headers: corsHeaders }
      );
    }
  };
};

export const createOptionsHandler = () => (req: NextRequest) => {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req.headers.get("origin")) });
};
