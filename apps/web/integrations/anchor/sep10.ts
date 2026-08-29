import "server-only";

import { AnchorConfig } from "@/integrations/anchor/config";
import { assertAllowedEndpoint, getErrorCodeFromStatus, parseJsonResponse } from "@/integrations/anchor/http";
import { AnchorToml, sep10ChallengeSchema, sep10TokenSchema } from "@/integrations/anchor/schemas";
import { AppError } from "@/lib/action-handler";
import { Keypair, Networks, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";

function networkPassphrase(config: AnchorConfig): string {
  return config.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
}

export async function authenticateWithSep10(params: {
  config: AnchorConfig;
  toml: AnchorToml;
  accountSecret: string;
}): Promise<string> {
  const { config, toml, accountSecret } = params;
  const keypair = Keypair.fromSecret(accountSecret);
  const authEndpoint = assertAllowedEndpoint(toml.WEB_AUTH_ENDPOINT, config.domain);
  authEndpoint.searchParams.set("account", keypair.publicKey());
  authEndpoint.searchParams.set("home_domain", config.domain);

  const challengeResponse = await fetch(authEndpoint, { cache: "no-store", redirect: "error" });
  const challenge = await parseJsonResponse(challengeResponse, sep10ChallengeSchema);
  if (!challengeResponse.ok) {
    throw new AppError(
      getErrorCodeFromStatus(challengeResponse.status),
      `SEP-10 challenge request failed (${challengeResponse.status})`,
      challengeResponse.status
    );
  }

  const passphrase = networkPassphrase(config);
  if (challenge.network_passphrase && challenge.network_passphrase !== passphrase) {
    throw new AppError("VALIDATION_ERROR", "SEP-10 challenge uses an unexpected network passphrase", 400);
  }

  const webAuthDomain = new URL(toml.WEB_AUTH_ENDPOINT).hostname;
  const details = WebAuth.readChallengeTx(
    challenge.transaction,
    toml.SIGNING_KEY,
    passphrase,
    config.domain,
    webAuthDomain
  );
  if (details.clientAccountID !== keypair.publicKey()) {
    throw new AppError("VALIDATION_ERROR", "SEP-10 challenge was issued for a different account", 400);
  }

  const transaction = TransactionBuilder.fromXDR(challenge.transaction, passphrase);
  transaction.sign(keypair);

  const tokenResponse = await fetch(assertAllowedEndpoint(toml.WEB_AUTH_ENDPOINT, config.domain), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: transaction.toXDR() }),
    cache: "no-store",
    redirect: "error",
  });
  const token = await parseJsonResponse(tokenResponse, sep10TokenSchema);
  if (!tokenResponse.ok) {
    throw new AppError(
      getErrorCodeFromStatus(tokenResponse.status),
      `SEP-10 token exchange failed (${tokenResponse.status})`,
      tokenResponse.status
    );
  }
  return token.token;
}
