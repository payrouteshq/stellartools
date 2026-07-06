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

    // 2. PREPARE CHARGE DATA
    const {
      data: [prior],
    } = await retrievePayments(orgId, env, { subscriptionId: subId, limit: 1 });
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

      return { status: "failed", subId, error: chargeRes.error.message };
    }

    // 4. PARSE ON-CHAIN SUCCESS
    const payEvent = chargeRes.value.events.find((e) => e.topic.includes("sub_pay"));
    if (!payEvent) throw new Error("Payment event missing in tx meta");

    const amountRaw = BigInt(String(payEvent.data.amount ?? 0));
    const cryptoAmount = (Number(amountRaw) / 10 ** STELLAR_PRECISION).toFixed(STELLAR_PRECISION);

    let nextPeriod: Date;
    if (sub.status === "trialing") {
      if (!billingMs) throw new Error("Invalid subscription billing period");
      nextPeriod = new Date(Date.now() + billingMs);

      const updateRes = await soroban$updateSubscriptionPeriod(env, {
        customerAddress: walletAddress,
        productId,
        periodDurationMs: billingMs,
        periodEnd: nextPeriod,
      });
      if (updateRes.isErr()) throw new Error(updateRes.error.message);
    } else {
      nextPeriod = new Date(Number(payEvent.data.periodEnd) * 1000);
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
