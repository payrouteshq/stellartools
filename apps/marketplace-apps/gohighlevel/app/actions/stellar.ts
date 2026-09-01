"use server";

import { getCredentials, getLocation, saveCredentials, saveWebhookRegistration } from "@/app/actions/db";
import { connectGhlProviderConfig } from "@/lib/ghl";
import { StellarTools } from "@stellartools/core";

export async function getConnectionStatus(locationId: string): Promise<{ test: boolean; live: boolean }> {
  const [testnet, mainnet] = await Promise.all([getCredentials(locationId, "testnet"), getCredentials(locationId, "mainnet")]);
  return { test: !!testnet, live: !!mainnet };
}

/**
 * `mode` is required from the manual /config form (the merchant picked which slot they're
 * filling). It's omitted for the auto-provision path off an app-installation token, where the
 * token's own network tells us which slot it belongs to.
 */
export async function connectStellarAccount(
  locationId: string,
  mode: "test" | "live" | undefined,
  apiKey: string
): Promise<true | string> {
  const location = await getLocation(locationId);
  if (!location) return "This location hasn't completed installation. Reopen the app from HighLevel.";

  const stellar = new StellarTools({ api_key: apiKey });
  let network: string;
  try {
    const result = await stellar.balance.retrieve();
    network = result.network;
  } catch {
    return "Could not validate this API key with StellarTools.";
  }

  const resolvedMode = mode ?? (network === "mainnet" ? "live" : "test");
  const expectedNetwork = resolvedMode === "live" ? "mainnet" : "testnet";
  if (network !== expectedNetwork) {
    return `This key belongs to StellarTools ${network}, not ${expectedNetwork}. Use the matching ${resolvedMode} key.`;
  }
  const { ghlSecret, publishableKey } = await saveCredentials(locationId, resolvedMode, apiKey);

  const existing = await getCredentials(locationId, expectedNetwork);
  if (!existing?.webhookId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const webhook = await stellar.webhooks.create({
      name: `HighLevel (${resolvedMode}) — ${locationId}`,
      url: `${appUrl}/api/stellar/webhook/${ghlSecret}`,
      description: "Relays payment confirmations to the HighLevel custom payments provider.",
      events: ["payment.confirmed", "payment.failed"],
    });
    await saveWebhookRegistration(ghlSecret, webhook.id, webhook.secret);
  }

  try {
    await connectGhlProviderConfig(location.access_token, {
      locationId,
      ...(resolvedMode === "live" ? { live: { apiKey: ghlSecret, publishableKey } } : { test: { apiKey: ghlSecret, publishableKey } }),
    });
  } catch (err) {
    return err instanceof Error ? err.message : "Saved locally, but HighLevel rejected the connection.";
  }

  return true;
}
