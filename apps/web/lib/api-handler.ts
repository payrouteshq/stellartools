import "server-only";

import { consumeRateLimit, getStoredResponse, saveIdempotencyResult, tryAcquireLock } from "@/actions/api-utils";
import { resolveAuthContext } from "@/actions/apikey";
import { getCorsHeaders } from "@/constant";
import { AuthContext } from "@/types";
import { AppScope } from "@stellartools/app-sdk/schema";
import {
  API_VERSIONS,
  ApiVersion,
  LATEST_VERSION,
  MaybePromise,
  Result,
  z as Schema,
  validateSchema,
} from "@stellartools/core";
import _ from "lodash";
import { NextRequest, NextResponse } from "next/server";

import { AppError } from "./action-handler";

const DEFAULT_LIMITS: Record<Exclude<AuthScope, "vercelToken">, number> = {
  apikey: 20,
  session: 20,
  portal: 20,
  app: 100,
};

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
  versioning?: {
    [version in ApiVersion]?: {
      schema?: { body?: Schema.ZodSchema<any>; query?: Schema.ZodSchema<any> };
      deprecated?: boolean;
      deprecationMessage?: string;
    };
  };
  handler: (args: {
    body: TBody;
    params: TParams;
    query: TQuery;
    auth: AuthContext;
    req: NextRequest;
    sessionToken?: string | null;
    version?: ApiVersion;
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
    const requestedVersion = (req.headers.get("StellarTools-Version") as ApiVersion) || LATEST_VERSION;

    let rateLimitHeaders: Record<string, string> = {};

    const headers = {
      ...corsHeaders,
      ...config.headers,
      ...rateLimitHeaders,
      "StellarTools-Version": requestedVersion,
    };

    try {
      if (!API_VERSIONS.includes(requestedVersion)) {
        throw new AppError("VALIDATION_ERROR", `Invalid API version: ${requestedVersion}`, 400);
      }

      const versionConfig = config.versioning?.[requestedVersion];

      if (versionConfig?.deprecated) {
        throw new AppError(
          "VALIDATION_ERROR",
          versionConfig.deprecationMessage || `API version ${requestedVersion} is deprecated`,
          400
        );
      }

      const activeSchemaParams = config.schema?.params;
      const activeSchemaBody = versionConfig?.schema?.body || config.schema?.body;
      const activeSchemaQuery = versionConfig?.schema?.query || config.schema?.query;

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
        throw new AppError("UNAUTHORIZED", "Unauthorized, please recheck your API key", 401);
      }

      // 2. RATE LIMITING
      if (authResult && authResult.type !== "vercelToken") {
        const baseLimit = DEFAULT_LIMITS[authResult.type];

        const customLimit = authResult.customApiRateLimit;
        const finalLimit = customLimit ?? baseLimit;

        const rl = await consumeRateLimit(authResult.organizationId, finalLimit, authResult.type);

        rateLimitHeaders = {
          "X-RateLimit-Limit": rl.limit.toString(),
          "X-RateLimit-Remaining": rl.remaining.toString(),
          "X-RateLimit-Reset": Math.floor(rl.reset.getTime() / 1000).toString(),
        };
      }

      // Permissions check
      if (authResult?.type === "app" && config.requiredAppScope) {
        const grantedScopes: string[] = authResult?.scopes ?? [];
        const allowedScopes: string[] = [
          ...grantedScopes,
          "write:app-installation",
          "read:app-installation", // Automatically allow all app tokens to read app installations
        ];

        // "*" is the wildcard grant meaning "all scopes"
        const hasPermission = grantedScopes.includes("*") || allowedScopes.includes(config.requiredAppScope);

        if (!hasPermission) {
          throw new AppError("FORBIDDEN", `Forbidden: App missing scope [${config.requiredAppScope}]`, 403);
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
      if (activeSchemaBody) {
        const json = await req.json().catch(() => ({}));
        const v = validateSchema(activeSchemaBody, json);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        body = v.value;
      }

      let params = rawParams;
      if (activeSchemaParams) {
        const v = validateSchema(activeSchemaParams, rawParams);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        params = v.value;
      }

      let query = rawQuery as any;
      if (activeSchemaQuery) {
        const v = validateSchema(activeSchemaQuery, rawQuery);
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
        version: requestedVersion,
      });

      // 5. CACHING & RESPONSE
      if (result instanceof Response) {
        // We generally don't cache raw Responses (streams/files) in idempotency jsonb
        return result;
      }

      if (result.isErr()) throw result.error;

      const processedData = (config.convertToSnakeCase ?? true) ? toSnakeCase(result.value) : result.value;

      if (idempotencyKey && authResult) {
        await saveIdempotencyResult(idempotencyKey, authResult.organizationId, 200, processedData);
      }

      return NextResponse.json(processedData, { headers });
    } catch (error: any) {
      const isAppError = error instanceof AppError;
      const status = isAppError ? error.status : 500;
      const code = isAppError ? error.code : "INTERNAL_SERVER_ERROR";

      const message = isAppError ? error.message : "An internal error occurred. Our engineers have been notified.";

      console.error(`[API_FAILURE] ${req.method} ${req.nextUrl.pathname}:`, {
        actual_error: error.message,
        stack: isAppError ? "AppError" : error.stack,
      });

      return NextResponse.json({ error: { code, message } }, { status, headers });
    }
  };
};

export const createOptionsHandler = () => (req: NextRequest) => {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req.headers.get("origin")) });
};
