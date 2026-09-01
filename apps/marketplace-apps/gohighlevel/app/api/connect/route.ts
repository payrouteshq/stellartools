import { buildGhlAuthorizeUrl, signGhlConnectState } from "@/lib/ghl";
import { HandlerError, routeHandler } from "@stellartools/core";

/**
 * Linked from the StellarTools "GoHighLevel" connector app — carries the org's raw StellarTools
 * app token in, signs it into GHL's OAuth `state`, and redirects into GHL's own consent screen.
 * `/install` verifies the state and auto-provisions on return.
 */
export const GET = routeHandler(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) throw new HandlerError("Missing token", 400);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const state = signGhlConnectState(token, process.env.GHL_STATE_SIGNING_SECRET!);

  return Response.redirect(
    buildGhlAuthorizeUrl({ clientId: process.env.GHL_CLIENT_ID!, redirectUri: `${appUrl}/install`, state })
  );
});
