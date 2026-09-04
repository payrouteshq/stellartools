import { z } from "zod";

import { validateSchema } from "./utils";

/**
 * Generic Next.js/Web-standard route handler wrapper for apps built on top of StellarTools
 * (marketplace apps, platform integrations) — not the public StellarTools API itself, which has
 * its own richer `apiHandler` in apps/web (DB-backed auth resolution, rate limiting,
 * idempotency); named differently here so the two never collide in an import. This package can't
 * depend on `next`, so it's written against the Web-standard `Request`/`Response` (which
 * `NextRequest`/`NextResponse` extend — pass `routeHandler<NextRequest>` to get `req` typed as one).
 */
export class HandlerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HandlerError";
    this.status = status;
  }
}

type RouteContext = { params?: Promise<Record<string, string>> };

export function routeHandler<TReq extends Request = Request, TBody = undefined>(
  handler: (req: TReq, ctx: { body: TBody; params: Record<string, string> }) => Promise<unknown>,
  options?: { schema?: z.ZodSchema<TBody> }
) {
  return async (req: TReq, routeCtx?: RouteContext): Promise<Response> => {
    try {
      let body = undefined as TBody;
      if (options?.schema) {
        const json = await req.json().catch(() => null);
        const result = validateSchema(options.schema, json);
        if (result.isErr()) return Response.json({ error: result.error.message }, { status: 400 });
        body = result.value;
      }

      const params = (await routeCtx?.params) ?? {};
      const result = await handler(req, { body, params });

      if (result instanceof Response) return result;
      return Response.json(result);
    } catch (err) {
      if (err instanceof HandlerError) return Response.json({ error: err.message }, { status: err.status });
      console.error("[routeHandler] unhandled error:", err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
