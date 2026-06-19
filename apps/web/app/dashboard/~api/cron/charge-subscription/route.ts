import { runAtomic } from "@/actions/event";
import { postPayment } from "@/actions/payment";
import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import {
  cancelSubscription as cancelSoroban,
  chargeSubscription as chargeSoroban,
} from "@/integrations/soroban-contract";
import { apiHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const GET = apiHandler({
  auth: null, // TODO: protect with Vercel secret

  handler: async () => {
    const { data: subs } = await retrieveSubscriptions(
      undefined,
      undefined,
      { isDue: true },
      { withCustomer: true, withProduct: true, withCustomerWallets: true }
    );
    const stats = { processed: 0, succeeded: 0, failed: 0 };

    for (const sub of subs) {
      const { id: subId, organizationId: orgId, environment: env, productId } = sub;

      if (!sub.product) continue;

      const { priceCents: productPriceCents, currencyCode: productCurrencyCode } = sub.product;

      if (!sub?.customerWallet) continue;

      const walletAddress = sub.customerWallet.address;

      if (!walletAddress) continue;
      stats.processed++;

      try {
        // --- 1. HANDLE CANCELLATIONS ---
        if (sub.cancelAtPeriodEnd) {
          const res = await cancelSoroban(env, orgId, sub.customerId, productId);
          if (res.isOk()) {
            await runAtomic(() => putSubscription(subId, { status: "canceled", canceledAt: new Date() }, orgId, env));
            stats.succeeded++;
          }
          continue;
        }

        // --- 2. EXECUTE ON-CHAIN CHARGE ---
        const chargeRes = await chargeSoroban(env, orgId, sub.customerId, productId);

        if (chargeRes.isErr()) {
          console.error(`[Cron] Soroban Charge Error for ${subId}:`, chargeRes.error.message);
          stats.failed++;
          continue;
        }

        const payEvent = chargeRes.value.events.find((e) => e.topic === "sub_pay");
        if (!payEvent) {
          stats.failed++;
          continue;
        }

        // --- 3. ATOMIC DB SYNC ---
        await runAtomic(async () => {
          const status = payEvent.success ? "confirmed" : "failed";
          // payEvent.data.amount is already a Stellar decimal string (e.g. "50.0000000")
          const cryptoAmount = String(payEvent.data.amount ?? "");

          if (payEvent.success) {
            await putSubscription(
              subId,
              {
                status: "active",
                currentPeriodEnd: new Date(payEvent.data.periodEnd as string | number),
              },
              orgId,
              env
            );
          }

          // Soroban events carry the asset code; fall back to XLM (native subscription token)
          const assetCode = payEvent.data.assetCode != null ? String(payEvent.data.assetCode) : "XLM";
          const assetIssuer = payEvent.data.assetIssuer != null ? String(payEvent.data.assetIssuer) : null;

          await postPayment(
            {
              subscriptionId: subId,
              checkoutId: null,
              productId,
              customerId: sub.customerId,
              amountCents: productPriceCents,
              currencyCode: productCurrencyCode,
              cryptoAmount,
              selectedAssetCode: assetCode,
              selectedAssetIssuer: assetIssuer,
              transactionHash: chargeRes.value.hash,
              status,
              metadata: null,
              creditBalanceId: null,
              failureReason: payEvent.success ? null : "On-chain payment failure",
            },
            orgId,
            env,
            {
              customerWalletAddress: chargeRes.value.sourceWalletAddress,
              failErrorMessage: payEvent.success ? undefined : "On-chain payment failure",
            }
          );
        });

        stats.succeeded++;
      } catch (err) {
        stats.failed++;
        console.error(`[Cron] Critical failure for ${subId}:`, err);
      }
    }

    return Result.ok({ stats, timestamp: new Date().toISOString() });
  },
});
