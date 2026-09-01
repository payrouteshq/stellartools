import { connectStellarAccount } from "@/app/actions/stellar";
import { HandlerError, routeHandler, z } from "@stellartools/core";

/** Called by apps/web's /ghl/config page (server-side proxy), not directly by browsers — hence the shared-secret check instead of a user session. */
export const POST = routeHandler(
  async (req, { body }) => {
    if (req.headers.get("x-internal-secret") !== process.env.GHL_INTERNAL_API_SECRET) {
      throw new HandlerError("Unauthorized", 401);
    }

    const result = await connectStellarAccount(body.locationId, body.mode, body.apiKey);
    if (result !== true) throw new HandlerError(result, 400);

    return { ok: true };
  },
  { schema: z.object({ locationId: z.string(), mode: z.enum(["test", "live"]).optional(), apiKey: z.string() }) }
);
