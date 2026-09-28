import { postLocation, retrieveLocation } from "@/app/actions/db";
import { connectStellarAccount } from "@/app/actions/stellar";
import {
  createGhlProviderConfig,
  enableGhlManualSubscriptions,
  exchangeGhlAuthorizationCode,
  verifyGhlConnectState,
} from "@/lib/ghl";
import { HandlerError, routeHandler } from "@stellartools/core";

export const GET = routeHandler(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) throw new HandlerError("Missing code", 400);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const webAppUrl = process.env.STELLARTOOLS_WEB_APP_URL!;

  const token = await exchangeGhlAuthorizationCode({
    clientId: process.env.GHL_CLIENT_ID!,
    clientSecret: process.env.GHL_CLIENT_SECRET!,
    code,
    redirectUri: `${appUrl}/install`,
  });

  if (!token.locationId) throw new HandlerError("OAuth response did not include a locationId", 400);

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await postLocation({
    locationId: token.locationId,
    companyId: token.companyId ?? null,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
  });

  const existing = await retrieveLocation(token.locationId);
  if (!existing?.provider_registered_at) {
    try {
      await createGhlProviderConfig(token.access_token, {
        name: process.env.GHL_PROVIDER_NAME ?? "StellarTools",
        description: process.env.GHL_PROVIDER_DESCRIPTION ?? "Accept Stellar-native payments and stablecoins.",
        imageUrl: process.env.GHL_PROVIDER_LOGO_URL ?? `${appUrl}/logo.png`,
        locationId: token.locationId,
        queryUrl: `${appUrl}/api/ghl/query`,
        paymentsUrl: `${webAppUrl}/ghl/checkout`,
      });

      await postLocation({
        locationId: token.locationId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        providerRegisteredAt: new Date(),
      });
    } catch (err) {
      console.error("[install] provider config registration failed, will retry on next install:", err);
    }

    try {
      await enableGhlManualSubscriptions(token.access_token, { locationId: token.locationId });
    } catch (err) {
      console.error("[install] enable manual subscriptions failed:", err);
    }
  }

  if (state) {
    try {
      const stellarAppToken = verifyGhlConnectState(state, process.env.GHL_STATE_SIGNING_SECRET!);
      const result = await connectStellarAccount(token.locationId, undefined, stellarAppToken);
      if (result === true) return Response.redirect(`${webAppUrl}/ghl/connected`);
      console.error("[install] auto-provision failed, falling back to manual setup:", result);
    } catch (err) {
      console.error("[install] state token invalid, falling back to manual setup:", err);
    }
  }

  return Response.redirect(`${webAppUrl}/ghl/config?locationId=${encodeURIComponent(token.locationId)}`);
});
