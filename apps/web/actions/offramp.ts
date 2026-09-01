"use server";

import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Payout, db, payouts } from "@/db";
import { getAnchorConfig } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { validateFundingInstructions } from "@/integrations/anchor/funding";
import { Sep24Transaction } from "@/integrations/anchor/schemas";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { mapSep24Status } from "@/integrations/anchor/status";
import { decrypt } from "@/integrations/encryption";
import { prepareAssetPayment, submitPreparedAssetPayment } from "@/integrations/stellar-core";
import Big from "big.js";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

function amountOutCents(amountOut: string | undefined): number | undefined {
  if (!amountOut) return undefined;
  return Number(new Big(amountOut).times(100).round(0, Big.roundHalfUp).toString());
}

export async function processFiatPayoutFunding(
  payout: Payout,
  secretKey: string,
  transaction: Sep24Transaction
): Promise<{ transactionHash: string }> {
  if (payout.transactionHash) {
    return { transactionHash: payout.transactionHash };
  }

  const config = getAnchorConfig(payout.environment, payout.provider ?? undefined);
  const asset = config.withdrawAssets.find(
    (candidate) => candidate.code === payout.selectedAssetCode && candidate.issuer === payout.selectedAssetIssuer
  );
  if (!asset) throw new Error("The stored payout asset is not supported by this provider");

  const instructions = validateFundingInstructions({
    transaction,
    requestedAmount: payout.cryptoAmount,
    asset,
  });

  let currentPayout = payout;

  if (!currentPayout.fundingTransactionXdr) {
    const prepared = await prepareAssetPayment({
      sourceSecret: secretKey,
      destination: instructions.destination,
      assetCode: asset.code,
      assetIssuer: asset.issuer ?? "",
      amount: instructions.amount,
      network: payout.environment,
      memo: instructions.memo,
    });

    const [claimed] = await db
      .update(payouts)
      .set({ fundingTransactionXdr: prepared.transactionXdr })
      .where(
        and(
          eq(payouts.id, payout.id),
          eq(payouts.organizationId, payout.organizationId),
          eq(payouts.environment, payout.environment),
          isNull(payouts.fundingTransactionXdr),
          isNull(payouts.transactionHash)
        )
      )
      .returning();

    if (!claimed) {
      const [refetched] = await db
        .select()
        .from(payouts)
        .where(eq(payouts.id, payout.id))
        .limit(1);
      if (!refetched) throw new Error("Payout not found");
      currentPayout = refetched;
    } else {
      currentPayout = claimed;
    }
  }

  if (currentPayout.transactionHash) {
    return { transactionHash: currentPayout.transactionHash };
  }

  if (!currentPayout.fundingTransactionXdr) {
    throw new Error("Another request is preparing this payout transaction");
  }

  try {
    const submitted = await submitPreparedAssetPayment(currentPayout.fundingTransactionXdr, payout.environment);
    await putPayout(currentPayout.id, {
      transactionHash: submitted.hash,
      failureCode: null,
      failureMessage: null,
    });
    return { transactionHash: submitted.hash };
  } catch (error: unknown) {
    await putPayout(currentPayout.id, {
      failureCode: "stellar_submission_failed",
      failureMessage: "The prepared Stellar payment could not be submitted and can be retried safely",
    });
    throw error;
  }
}

export async function reconcileFiatPayout(payout: Payout): Promise<{
  payoutId: string;
  providerStatus: string;
  status: "pending" | "succeeded" | "failed";
  transactionHash?: string | null;
}> {
  if (!payout.provider || !payout.providerTransactionId) throw new Error("Payout has no provider transaction");
  const config = getAnchorConfig(payout.environment, payout.provider);
  const { secret } = await retrieveOrganizationIdAndSecret(payout.organizationId, payout.environment);
  if (!secret) throw new Error("Organization wallet is not configured");
  const secretKey = decrypt(secret.encrypted.replace(SENSITIVE_KEY_PREFIX, ""));
  const toml = await discoverAnchor(config);
  const token = await authenticateWithSep10({ config, toml, accountSecret: secretKey });
  const client = new Sep24Client(config, toml, token);
  let transaction = await client.getTransaction(payout.providerTransactionId);

  let updatedTransactionHash = payout.transactionHash;

  if (transaction.status === "pending_user_transfer_start" && !payout.transactionHash) {
    try {
      const fundResult = await processFiatPayoutFunding(payout, secretKey, transaction);
      updatedTransactionHash = fundResult.transactionHash;
      transaction = await client.getTransaction(payout.providerTransactionId);
    } catch (error) {
      console.error("[AUTO_FUNDING_FAILED]", payout.id, error);
    }
  }

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

  return { payoutId: payout.id, providerStatus: transaction.status, status, transactionHash: updatedTransactionHash };
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

