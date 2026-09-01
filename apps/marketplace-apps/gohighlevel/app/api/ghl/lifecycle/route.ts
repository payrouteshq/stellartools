import { deleteLocation } from "@/app/actions/db";
import { routeHandler, z } from "@stellartools/core";

/**
 * HighLevel's standard Marketplace app lifecycle webhook (install/uninstall), configured
 * separately from the payments queryUrl/paymentsUrl in the app's Marketplace settings. INSTALL
 * is handled by the /install OAuth redirect, which fires per-location on first connect.
 */
export const POST = routeHandler(
  async (_req, { body }) => {
    if (body.type === "UNINSTALL") await deleteLocation(body.locationId);
    return { ok: true };
  },
  { schema: z.object({ type: z.string(), locationId: z.string() }) }
);
