import "server-only";

import { resolveAuthContext } from "@/actions/apikey";
import { getCorsHeaders } from "@/constant";
import { processResource } from "@/lib/api-registry";
import { AuthContext } from "@/types";
import { AppScope } from "@stellartools/app-sdk";
import { Result, z as Schema, validateSchema } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";

/**
 * Marked as dangerous because it allows appTokens to write to the db,
 * But it's only used for app installations and we trust the app to not abuse it.
 */
export type DangerouslyAllowedAppScopes = "write:app-installation";

export const mcpToolsRegistry = new Map<string, HandlerConfig<any, any, any>>();

export type AuthScope = "session" | "apikey" | "portal" | "app";

const AUTH_SCOPE_LABELS: Record<AuthScope, string> = {
  apikey: "API Key",
  session: "Session Token",
  portal: "Portal Token",
  app: "App Token",
};

function authRequiredMessage(scopes: Array<AuthScope>): string {
  const labels = scopes.map((s) => AUTH_SCOPE_LABELS[s]);
  return `${labels.join(" or ")} required`;
}

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
  }) => Promise<Result<any, Error>>;
  headers?: Record<string, string>;
  convertToSnakeCase?: boolean;
};

export const apiHandler = <TBody = any, TParams = any, TQuery = any>(config: HandlerConfig<TBody, TParams, TQuery>) => {
  if (config.mcp) {
    mcpToolsRegistry.set(config.mcp.name, config);
  }

  return async (req: NextRequest, context: { params: Promise<any> }) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);

    try {
      const rawParams = await context.params;

      const { searchParams } = new URL(req.url);
      const rawQuery = Object.fromEntries(searchParams.entries());

      let authResult: AuthContext | null = null;
      const allowedScopes = config.auth?.length ? config.auth : null;

      if (allowedScopes) {
        const authParams = {
          apiKey: req.headers.get("x-api-key"),
          sessionToken: req.headers.get("x-session-token"),
          portalToken: req.headers.get("x-portal-token"),
          appToken: req.headers.get("x-stellartools-app-token"),
        };

        const hasAnyCreds = Object.values(authParams).some(Boolean);
        if (!hasAnyCreds) {
          return NextResponse.json(
            { error: authRequiredMessage(allowedScopes) },
            { status: 401, headers: corsHeaders }
          );
        }

        authResult = await resolveAuthContext(authParams);
        if (!authResult) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        if (authResult.type === "app" && config.requiredAppScope) {
          const hasPermission = [...(authResult?.scopes ?? []), "write:app-installation"]?.includes(
            config.requiredAppScope
          );

          if (!hasPermission) {
            return NextResponse.json(
              { error: `Forbidden: App missing scope [${config.requiredAppScope}]` },
              { status: 403, headers: corsHeaders }
            );
          }
        }
      }

      let body: TBody = {} as TBody;
      if (config.schema?.body) {
        const json = await req.json().catch(() => ({}));
        const v = validateSchema(config.schema.body, json);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        body = v.value;
      }

      let params: TParams = rawParams;
      if (config.schema?.params) {
        const v = validateSchema(config.schema.params, rawParams);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        params = v.value;
      }

      let query: TQuery = rawQuery as any;

      if (config.schema?.query) {
        const v = validateSchema(config.schema.query, rawQuery);
        if (v.isErr()) return NextResponse.json({ error: v.error.message }, { status: 400, headers: corsHeaders });
        query = v.value;
      }

      let result: Result<any, Error>;

      if (authResult) {
        const sessionToken = req.headers.get("x-session-token");

        result = await config.handler({ body, params, query, auth: authResult, req, sessionToken });

        if (result.isErr()) {
          return NextResponse.json({ error: result.error.message }, { status: 400, headers: corsHeaders });
        }

        const rawValue = result.value;

        if (rawValue && typeof rawValue === "object" && "has_more" in rawValue) {
          return NextResponse.json(
            {
              object: "list",
              data: processResource(rawValue.data, config.convertToSnakeCase ?? true),
              has_more: rawValue.has_more,
              url: req.nextUrl.pathname,
            },
            { headers: corsHeaders }
          );
        }

        return NextResponse.json(processResource(rawValue), { headers: corsHeaders });
      }
    } catch (error: any) {
      console.error("[API_ERROR]", error);
      return NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500, headers: corsHeaders }
      );
    }
  };
};

export const createOptionsHandler = () => (req: NextRequest) =>
  new NextResponse(null, { status: 204, headers: getCorsHeaders(req.headers.get("origin")) });
