"use server";

import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Payout, db, payouts } from "@/db";
import { getAnchorConfig } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { mapSep24Status } from "@/integrations/anchor/status";
import { decrypt } from "@/integrations/encryption";
import Big from "big.js";
import { and, eq, isNotNull } from "drizzle-orm";

function amountOutCents(amountOut: string | undefined): number | undefined {
  if (!amountOut) return undefined;
  return Number(new Big(amountOut).times(100).round(0, Big.roundHalfUp).toString());
}

export async function reconcileFiatPayout(payout: Payout): Promise<{
  payoutId: string;
  providerStatus: string;
  status: "pending" | "succeeded" | "failed";
}> {
  if (!payout.provider || !payout.providerTransactionId) throw new Error("Payout has no provider transaction");
  const config = getAnchorConfig(payout.environment, payout.provider);
  const { secret } = await retrieveOrganizationIdAndSecret(payout.organizationId, payout.environment);
  if (!secret) throw new Error("Organization wallet is not configured");
  const secretKey = decrypt(secret.encrypted.replace(SENSITIVE_KEY_PREFIX, ""));
  const toml = await discoverAnchor(config);
  const token = await authenticateWithSep10({ config, toml, accountSecret: secretKey });
  const transaction = await new Sep24Client(config, toml, token).getTransaction(payout.providerTransactionId);
  const status = mapSep24Status(transaction.status);
  const amountCents = amountOutCents(transaction.amount_out);

  await putPayout(payout.id, {
    status,
    providerStatus: transaction.status,
    providerUpdatedAt: new Date(),
    completedAt: status === "succeeded" ? new Date() : payout.completedAt,
    ...(amountCents === undefined ? {} : { amountCents, metadata: null }),
    ...(status === "failed" ? { failureCode: transaction.status, failureMessage: transaction.message } : {}),
  });

  return { payoutId: payout.id, providerStatus: transaction.status, status };
}

export async function reconcilePendingFiatPayouts(limit = 50) {
  const pending = await db
    .select()
    .from(payouts)
    .where(
      and(
        eq(payouts.method, "fiat"),
        eq(payouts.status, "pending"),
        isNotNull(payouts.provider),
        isNotNull(payouts.providerTransactionId)
      )
    )
    .limit(limit);

  const results = [];
  for (const payout of pending) {
    try {
      results.push({ ok: true as const, ...(await reconcileFiatPayout(payout)) });
    } catch (error: unknown) {
      results.push({
        ok: false as const,
        payoutId: payout.id,
        error: error instanceof Error ? error.message : "Unknown reconciliation error",
      });
    }
  }
  return results;
}
