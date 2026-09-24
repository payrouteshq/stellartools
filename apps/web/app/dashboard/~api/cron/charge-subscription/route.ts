import { retrieveCustomerWallets } from "@/actions/customers";
import { runAtomic } from "@/actions/event";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayment, retrievePayments } from "@/actions/payment";
import { putSubscription, retrieveDueSubscriptions } from "@/actions/subscription";
import { STELLAR_PRECISION, subscriptionPeriodMs } from "@/constant";
import { ResolvedSubscription } from "@/db";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
  chargeSubscription as soroban$chargeSubscription,
  retrieveSubscription as soroban$retrieveSubscription,
  updateSubscriptionPeriod as soroban$updateSubscriptionPeriod,
} from "@/integrations/soroban-contract";
import { apiHandler } from "@/lib/api-handler";
import { Money } from "@/lib/money";
import {
  MAX_CONSECUTIVE_FAILED_PAYMENTS_BEFORE_MARKED_AS_OVERDUE,
  shouldMarkOverdueAfterFailures,
} from "@/lib/subscription";
import { generateResourceId } from "@/lib/utils";
import { Result } from "@stellartools/core";
import _ from "lodash";

const CONCURRENCY_LIMIT = 5;

async function processSingleSubscription(sub: ResolvedSubscription) {
  const { id: subId, organizationId: orgId, environment: env, productId } = sub;
  let walletAddress = sub?.customerWallet?.address;

  if (!sub.product) {
    return { status: "error", subId, error: `Product ${productId} not found` };
  }

  const { priceCents, currencyCode, recurringPeriod, customDurationMs } = sub.product;
  const billingMs = subscriptionPeriodMs(recurringPeriod, customDurationMs);

  try {
    // 1. HANDLE CANCELLATION
    if (sub.cancelAtPeriodEnd) {
      if (!walletAddress) return { status: "error", subId, error: "Customer wallet not found" };
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

    const { secret } = await retrieveOrganizationIdAndSecret(orgId, env);
    const merchantPublicKey = secret?.publicKey;
    if (!merchantPublicKey) return { status: "error", subId, error: "Merchant public key not found" };

    const { cryptoAmount: chargeDisplay, amountRaw: chargeRaw } = await Money.calculateSubscriptionAmount({
      priceCents,
      currencyCode,
      assetMetadata: { usdPeg: true },
    });

    // 3. EXECUTE ON-CHAIN CHARGE
    const customerWallets = await retrieveCustomerWallets(sub.customerId, undefined, orgId, env);
    const walletAddresses = [walletAddress, ...customerWallets.map((wallet) => wallet.address)].filter(
      (address, index, addresses): address is string => !!address && addresses.indexOf(address) === index
    );
    if (walletAddresses.length === 0) {
      return { status: "error", subId, error: "Customer wallet not found" };
    }

    let chargeRes: Awaited<ReturnType<typeof soroban$chargeSubscription>> | undefined;
    for (const address of walletAddresses) {
      walletAddress = address;
      chargeRes = await soroban$chargeSubscription(env, address, merchantPublicKey, productId, chargeRaw);
      if (chargeRes.isOk()) break;
    }

    if (!chargeRes) return { status: "error", subId, error: "Customer wallet not found" };
    const chargedWalletAddress = walletAddress!;

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
          { customerWalletAddress: chargedWalletAddress }
        );
      });

      // Dunning: after N consecutive failed charges stop automatic retries and
      // expose a hosted invoice so the customer can recover the subscription.
      const { data: recentPayments } = await retrievePayments(orgId, env, {
        subscriptionId: subId,
        limit: MAX_CONSECUTIVE_FAILED_PAYMENTS_BEFORE_MARKED_AS_OVERDUE,
      });

      if (shouldMarkOverdueAfterFailures(recentPayments.map((p) => p.status))) {
        await putSubscription(
          subId,
          { status: "overdue", invoiceToken: sub.invoiceToken ?? generateResourceId("inv", orgId, 40) },
          orgId,
          env
        );
        return {
          status: "failed",
          subId,
          error: `Overdue after ${MAX_CONSECUTIVE_FAILED_PAYMENTS_BEFORE_MARKED_AS_OVERDUE} consecutive failed charges: ${chargeRes.error.message}`,
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
      const chargedWallet = customerWallets.find((wallet) => wallet.address === chargedWalletAddress);
      await putSubscription(
        subId,
        { status: "active", currentPeriodEnd: nextPeriod, customerWalletId: chargedWallet?.id ?? sub.customerWalletId },
        orgId,
        env
      );
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
        { customerWalletAddress: chargedWalletAddress }
      );
    });

    // 6. For converted trials, sync the real billing period on-chain. The
    // payment is already recorded above.
    if (sub.status === "trialing") {
      const currentSub = await soroban$retrieveSubscription(env, chargedWalletAddress, merchantPublicKey, productId);
      if (currentSub.isErr()) {
        return {
          status: "error",
          subId,
          error: `Charge recorded but reading on-chain subscription failed: ${currentSub.error.message}`,
        };
      }

      const updateRes = await soroban$updateSubscriptionPeriod(env, {
        customerAddress: chargedWalletAddress,
        merchantAddress: merchantPublicKey,
        productId,
        periodDurationMs: billingMs,
        periodEnd: nextPeriod,
        // Carry the existing ceiling through unchanged — this call only
        // syncs the billing period after a trial converts, it's not meant
        // to change how much a future charge is allowed to request.
        maxAmountRaw: currentSub.value.maxAmount,
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
