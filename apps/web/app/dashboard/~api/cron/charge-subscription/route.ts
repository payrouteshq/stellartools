import { retrieveSupportedAssets } from "@/actions/asset";
import { runAtomic } from "@/actions/event";
import { postPayment, retrievePayments } from "@/actions/payment";
import { putSubscription, retrieveDueSubscriptions } from "@/actions/subscription";
import { STELLAR_PRECISION } from "@/constant";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
  chargeSubscription as soroban$chargeSubscription,
} from "@/integrations/soroban-contract";
import { apiHandler } from "@/lib/api-handler";
import { Money } from "@/lib/money";
import { Result } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["vercelToken"],
  handler: async () => {
    const subs = await retrieveDueSubscriptions({
      withCustomer: true,
      withProduct: true,
      withCustomerWallets: true,
    });

    const stats = { processed: 0, succeeded: 0, failed: 0 };

    for (const sub of subs) {
      const { id: subId, organizationId: orgId, environment: env, productId } = sub;

      if (!sub.product) continue;

      const { priceCents: productPriceCents, currencyCode: productCurrencyCode } = sub.product;

      if (!sub?.customerWallet?.address) continue;

      const walletAddress = sub.customerWallet.address;
      stats.processed++;

      try {
        if (sub.cancelAtPeriodEnd) {
          const merchantSecret = await resolveMerchantSecret(orgId, env);
          const res = await soroban$cancelSubscription(env, merchantSecret, walletAddress, productId);
          if (res.isOk()) {
            await runAtomic(() => putSubscription(subId, { status: "canceled", canceledAt: new Date() }, orgId, env));
            stats.succeeded++;
          } else {
            stats.failed++;
          }
          continue;
        }

        const { data: priorPayments } = await retrievePayments(orgId, env, { subscriptionId: subId, limit: 1 });
        const priorPayment = priorPayments[0];
        const assetCode = priorPayment?.selectedAssetCode ?? "XLM";
        const [asset] = await retrieveSupportedAssets({ code: assetCode }, env);

        const { cryptoAmount: chargeCryptoAmount, amountRaw: chargeAmountRaw } =
          await Money.calculateSubscriptionAmount({
            priceCents: productPriceCents,
            currencyCode: productCurrencyCode,
            assetMetadata: asset?.metadata ?? {},
          });

        const chargeRes = await soroban$chargeSubscription(env, walletAddress, productId, chargeAmountRaw);

        console.dir(chargeRes, { depth: 200 });

        if (chargeRes.isErr()) {
          console.error(`[Cron] Soroban charge error for ${subId}:`, chargeRes.error.message);

          await runAtomic(async () => {
            await putSubscription(subId, { status: "past_due" }, orgId, env);
            await postPayment(
              {
                subscriptionId: subId,
                checkoutId: null,
                productId,
                customerId: sub.customerId,
                amountCents: productPriceCents,
                currencyCode: productCurrencyCode,
                cryptoAmount: chargeCryptoAmount,
                selectedAssetCode: priorPayment?.selectedAssetCode ?? "XLM",
                selectedAssetIssuer: priorPayment?.selectedAssetIssuer ?? null,
                transactionHash: "",
                status: "failed",
                metadata: null,
                failureReason: chargeRes.error.message,
              },
              orgId,
              env,
              { customerWalletAddress: walletAddress, failErrorMessage: chargeRes.error.message }
            );
          });

          stats.failed++;
          continue;
        }

        const payEvent = chargeRes.value.events.find((e) => e.topic.includes("sub_pay"));
        if (!payEvent) {
          stats.failed++;
          continue;
        }

        const periodEndSec = Number(payEvent.data.periodEnd);
        const amountRaw = BigInt(String(payEvent.data.amount ?? 0));
        const cryptoAmount = (Number(amountRaw) / 10 ** STELLAR_PRECISION).toFixed(STELLAR_PRECISION);

        await runAtomic(async () => {
          if (Number.isFinite(periodEndSec)) {
            await putSubscription(
              subId,
              {
                status: "active",
                currentPeriodEnd: new Date(periodEndSec * 1000),
              },
              orgId,
              env
            );
          }

          await postPayment(
            {
              subscriptionId: subId,
              checkoutId: null,
              productId,
              customerId: sub.customerId,
              amountCents: productPriceCents,
              currencyCode: productCurrencyCode,
              cryptoAmount,
              selectedAssetCode: priorPayment?.selectedAssetCode ?? "XLM",
              selectedAssetIssuer: priorPayment?.selectedAssetIssuer ?? null,
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

        stats.succeeded++;
      } catch (err) {
        stats.failed++;
        console.error(`[Cron] Critical failure for ${subId}:`, err);
      }
    }

    return Result.ok({ stats, timestamp: new Date().toISOString() });
  },
});
