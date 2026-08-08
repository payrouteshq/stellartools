import { retrieveSupportedAssets } from "@/actions/asset";
import { runAtomic } from "@/actions/event";
import { postPayment, retrievePayments } from "@/actions/payment";
import { putSubscription, retrieveDueSubscriptions } from "@/actions/subscription";
import { STELLAR_PRECISION, subscriptionPeriodMs } from "@/constant";
import { ResolvedSubscription } from "@/db";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
  chargeSubscription as soroban$chargeSubscription,
  updateSubscriptionPeriod as soroban$updateSubscriptionPeriod,
} from "@/integrations/soroban-contract";
import { apiHandler } from "@/lib/api-handler";
import { Money } from "@/lib/money";
import { MAX_CONSECUTIVE_FAILED_PAYMENTS, shouldCancelAfterFailures } from "@/lib/subscription";
import { Result } from "@stellartools/core";
import _ from "lodash";

const CONCURRENCY_LIMIT = 5;

async function processSingleSubscription(sub: ResolvedSubscription) {
  const { id: subId, organizationId: orgId, environment: env, productId } = sub;
  const walletAddress = sub?.customerWallet?.address;

  if (!walletAddress || !sub.product) {
    return { status: "error", subId, error: `Customer wallet ${walletAddress} or Product ${productId} not found` };
  }

  const { priceCents, currencyCode, recurringPeriod, customDurationMs } = sub.product;
  const billingMs = subscriptionPeriodMs(recurringPeriod, customDurationMs);

  try {
    // 1. HANDLE CANCELLATION
    if (sub.cancelAtPeriodEnd) {
      const merchantSecret = await resolveMerchantSecret(orgId, env);

      const res = await soroban$cancelSubscription(env, merchantSecret, walletAddress, productId);

      if (res.isOk()) {
        await putSubscription(subId, { status: "canceled", canceledAt: new Date() }, orgId, env);
        return { status: "succeeded", subId };
      }
      throw new Error("Soroban cancellation failed");
    }

    // Never take money on-chain for a subscription we cannot roll forward.
    if (!billingMs) {
      return { status: "error", subId, error: "Invalid subscription billing period" };
    }

    // 2. PREPARE CHARGE DATA
    const {
      data: [prior],
    } = await retrievePayments(orgId, env, { subscriptionId: subId, limit: 1 });

    if (!prior) {
      return { status: "error", subId, error: "No prior payment found to determine the charge asset" };
    }

    const [asset] = await retrieveSupportedAssets({ code: prior.selectedAssetCode }, env);

    const { cryptoAmount: chargeDisplay, amountRaw: chargeRaw } = await Money.calculateSubscriptionAmount({
      priceCents,
      currencyCode,
      assetMetadata: asset?.metadata ?? {},
    });

    // 3. EXECUTE ON-CHAIN CHARGE
    const chargeRes = await soroban$chargeSubscription(env, walletAddress, productId, chargeRaw);

    if (chargeRes.isErr()) {
      await runAtomic(async () => {
        await putSubscription(subId, { status: "past_due" }, orgId, env);
        await postPayment(
          {
            subscriptionId: subId,
            checkoutId: null,
            productId,
            customerId: sub.customerId,
            amountCents: priceCents,
            currencyCode,
            cryptoAmount: chargeDisplay,
            selectedAssetCode: prior.selectedAssetCode,
            selectedAssetIssuer: prior.selectedAssetIssuer,
            transactionHash: `failed_${subId}_${Date.now()}`,
            status: "failed",
            metadata: null,
            failureReason: chargeRes.error.message,
          },
          orgId,
          env,
          { customerWalletAddress: walletAddress }
        );
      });

      // Dunning: after N consecutive failed charges stop retrying and cancel,
      // so wallets are not hit indefinitely.
      const { data: recentPayments } = await retrievePayments(orgId, env, {
        subscriptionId: subId,
        limit: MAX_CONSECUTIVE_FAILED_PAYMENTS,
      });

      if (shouldCancelAfterFailures(recentPayments.map((p) => p.status))) {
        try {
          const merchantSecret = await resolveMerchantSecret(orgId, env);

          await soroban$cancelSubscription(env, merchantSecret, walletAddress, productId);
        } catch (cancelErr: any) {
          console.error(`[Cron] On-chain cancel failed for sub ${subId}:`, cancelErr?.message);
        }
        await putSubscription(subId, { status: "canceled", canceledAt: new Date() }, orgId, env);
        return {
          status: "failed",
          subId,
          error: `Canceled after ${MAX_CONSECUTIVE_FAILED_PAYMENTS} consecutive failed charges: ${chargeRes.error.message}`,
        };
      }

      return { status: "failed", subId, error: chargeRes.error.message };
    }

    // 4. PARSE ON-CHAIN SUCCESS. The charge already settled on-chain, so from
    // here on we must never throw before recording the payment — a lost record
    // would double-charge the customer on the next cron run.
    const payEvent = chargeRes.value.events.find((e) => e.topic.includes("sub_pay"));

    const cryptoAmount = payEvent
      ? (Number(BigInt(String(payEvent.data.amount ?? 0))) / 10 ** STELLAR_PRECISION).toFixed(STELLAR_PRECISION)
      : chargeDisplay;

    let nextPeriod: Date;
    if (sub.status !== "trialing" && payEvent?.data.periodEnd) {
      nextPeriod = new Date(Number(payEvent.data.periodEnd) * 1000);
    } else {
      nextPeriod = new Date(Date.now() + billingMs);
    }

    // 5. UPDATE STATE
    await runAtomic(async () => {
      await putSubscription(subId, { status: "active", currentPeriodEnd: nextPeriod }, orgId, env);
      await postPayment(
        {
          subscriptionId: subId,
          checkoutId: null,
          productId,
          customerId: sub.customerId,
          amountCents: priceCents,
          currencyCode,
          cryptoAmount,
          selectedAssetCode: prior.selectedAssetCode,
          selectedAssetIssuer: prior.selectedAssetIssuer,
          transactionHash: chargeRes.value.hash,
          status: "confirmed",
          metadata: null,
          failureReason: null,
        },
        orgId,
        env,
        { customerWalletAddress: walletAddress }
      );
    });

    // 6. For converted trials, sync the real billing period on-chain. The
    // payment is already recorded above.
    if (sub.status === "trialing") {
      const updateRes = await soroban$updateSubscriptionPeriod(env, {
        customerAddress: walletAddress,
        productId,
        periodDurationMs: billingMs,
        periodEnd: nextPeriod,
      });

      if (updateRes.isErr()) {
        return {
          status: "error",
          subId,
          error: `Charge recorded but on-chain period sync failed: ${updateRes.error.message}`,
        };
      }
    }

    return { status: "succeeded", subId };
  } catch (err: any) {
    console.error(`[Cron] Critical error for sub ${subId}:`, err.message);
    return { status: "error", subId, error: err.message };
  }
}

export const GET = apiHandler({
  auth: ["vercelToken"],
  handler: async () => {
    const subs = await retrieveDueSubscriptions({
      withCustomer: true,
      withProduct: true,
      withCustomerWallets: true,
    });

    const total = subs.length;
    const batches = _.chunk(subs, CONCURRENCY_LIMIT);
    const results = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map((sub) => processSingleSubscription(sub)));
      results.push(...batchResults);
    }

    const stats = {
      processed: total,
      succeeded: results.filter((r) => r.status === "succeeded").length,
      failed: results.filter((r) => r.status !== "succeeded").length,
    };

    return Result.ok({
      stats,
      timestamp: new Date().toISOString(),
      details: results.filter((r) => r.status !== "succeeded"),
    });
  },
});
