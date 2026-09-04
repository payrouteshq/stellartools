"use server";

import { postCredentials, retrieveCredentials, retrieveLocation } from "@/app/actions/db";
import { connectGhlProviderConfig } from "@/lib/ghl";
import { Network, StellarTools } from "@stellartools/core";

export async function getConnectionStatus(locationId: string): Promise<{ testnet: boolean; mainnet: boolean }> {
  const [testnet, mainnet] = await Promise.all([
    retrieveCredentials({ locationId, environment: "testnet" }),
    retrieveCredentials({ locationId, environment: "mainnet" }),
  ]);
  return { testnet: !!testnet, mainnet: !!mainnet };
}

export async function connectStellarAccount(
  locationId: string,
  environment: Network | undefined,
  apiKey: string
): Promise<true | string> {
  const location = await retrieveLocation(locationId);
  if (!location) return "This location hasn't completed installation. Reopen the app from HighLevel.";

  const stellar = new StellarTools({ api_key: apiKey });
  let detectedNetwork: Network;
  const isTestKey = apiKey.startsWith("st_test_") || apiKey.startsWith("sk_test_");
  const isLiveKey = apiKey.startsWith("st_live_") || apiKey.startsWith("sk_live_");

  try {
    const result = await stellar.balance.retrieve();
    detectedNetwork = result.network as Network;
  } catch {
    if (isTestKey || isLiveKey) {
      detectedNetwork = isTestKey ? "testnet" : "mainnet";
    } else if (apiKey.startsWith("st_")) {
      detectedNetwork = "testnet";
    } else {
      return "Could not validate this API key with StellarTools.";
    }
  }

  const expectedNetwork = environment ?? detectedNetwork;
  if (detectedNetwork !== expectedNetwork) {
    return `This key belongs to StellarTools ${detectedNetwork}, not ${expectedNetwork}. Use a key matching ${expectedNetwork}.`;
  }

  const { ghlSecret, publishableKey } = await postCredentials({
    locationId,
    environment: expectedNetwork,
    stellarApiKey: apiKey,
  });

  const existing = await retrieveCredentials({ locationId, environment: expectedNetwork });
  if (!existing?.webhookId) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      const webhook = await stellar.webhooks.create({
        name: `HighLevel (${expectedNetwork}) — ${locationId}`,
        url: `${appUrl}/api/stellar/webhook/${ghlSecret}`,
        description: "Relays payment confirmations to HighLevel custom payments provider.",
        events: ["payment.confirmed", "payment.failed"],
      });

      await postCredentials({
        locationId,
        environment: expectedNetwork,
        stellarApiKey: apiKey,
        publishableKey,
        ghlSecret,
        webhookId: webhook.id,
        webhookSecret: webhook.secret,
      });
    } catch (err) {
      console.error("[connectStellarAccount] webhook registration skipped in local dev:", err);
    }
  }

  // Skip HighLevel API registration call when using a dummy token ("x") in local development
  if (location.access_token !== "x") {
    try {
      await connectGhlProviderConfig(location.access_token, {
        locationId,
        ...(expectedNetwork === "mainnet"
          ? { live: { apiKey: ghlSecret, publishableKey } }
          : { test: { apiKey: ghlSecret, publishableKey } }),
      });
    } catch (err) {
      return err instanceof Error ? err.message : "Saved locally, but HighLevel rejected the connection.";
    }
  }

  return true;
}
