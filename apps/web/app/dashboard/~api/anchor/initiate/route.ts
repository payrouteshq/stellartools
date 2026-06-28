import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import * as StellarSDK from "@stellar/stellar-sdk";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const parseToml = (toml: string, key: string) => toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1];

// Anchor domain is configured per environment via env vars.
// Testnet falls back to Stellar's official test anchor.
const getAnchorDomain = (environment: "testnet" | "mainnet") => {
  if (environment === "testnet") {
    return process.env.ANCHOR_DOMAIN_TESTNET ?? "testanchor.stellar.org";
  }
  const domain = process.env.ANCHOR_DOMAIN_MAINNET;
  if (!domain) throw new AppError("ANCHOR_DOMAIN_MAINNET is not configured");
  return domain;
};

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: {
    body: Schema.object({
      assetCode: Schema.string(),
      amount: Schema.string().optional(),
    }),
  },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);
    if (!secret) throw new AppError("Organization has no Stellar account configured");

    const secretKey = decrypt(secret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? "");
    const keypair = StellarSDK.Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();

    const networkPassphrase = environment === "testnet" ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC;

    const anchorDomain = getAnchorDomain(environment);

    // --- Fetch & parse stellar.toml ---
    const tomlResp = await fetch(`https://${anchorDomain}/.well-known/stellar.toml`);
    if (!tomlResp.ok) throw new AppError(`Could not reach anchor at ${anchorDomain}`);
    const toml = await tomlResp.text();

    const webAuthEndpoint = parseToml(toml, "WEB_AUTH_ENDPOINT");
    const transferServer = parseToml(toml, "TRANSFER_SERVER_SEP0024");
    const signingKey = parseToml(toml, "SIGNING_KEY");

    if (!webAuthEndpoint || !transferServer || !signingKey) {
      throw new AppError("Configured anchor does not support SEP-24 or SEP-10");
    }

    // --- SEP-10: Get challenge transaction ---
    const challengeParams = new URLSearchParams({ account: publicKey, home_domain: anchorDomain });
    const challengeResp = await fetch(`${webAuthEndpoint}?${challengeParams}`);
    const challengeJson = await challengeResp.json();

    if (!challengeJson.transaction) {
      throw new AppError(challengeJson.error || "Failed to get SEP-10 challenge from anchor");
    }

    // --- Sign the challenge ---
    const tx = new StellarSDK.Transaction(
      challengeJson.transaction,
      challengeJson.network_passphrase || networkPassphrase
    );
    tx.sign(keypair);
    const signedXdr = tx.toEnvelope().toXDR("base64");

    // --- Submit signed challenge to get JWT ---
    const authResp = await fetch(webAuthEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: signedXdr }),
    });
    const { token: anchorJwt } = await authResp.json();
    if (!anchorJwt) throw new AppError("SEP-10 authentication failed – anchor rejected signature");

    // --- Initiate SEP-24 interactive withdrawal ---
    const formData = new FormData();
    formData.append("asset_code", body.assetCode);
    formData.append("account", publicKey);
    formData.append("lang", "en");
    if (body.amount) formData.append("amount", body.amount);

    const withdrawResp = await fetch(`${transferServer}/transactions/withdraw/interactive`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anchorJwt}` },
      body: formData,
    });
    const withdrawData = await withdrawResp.json();

    if (!withdrawData.url || !withdrawData.id) {
      throw new AppError(withdrawData.error || "Anchor rejected the withdrawal request");
    }

    // Append postMessage callback so the popup can notify us on completion
    const popupUrl = `${withdrawData.url}&callback=postMessage`;

    return Result.ok({
      url: popupUrl,
      id: withdrawData.id,
      transferServer,
      anchorJwt,
    });
  },
});
