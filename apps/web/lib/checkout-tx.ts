"use server";

import { retrieveSupportedAssets } from "@/actions/asset";
import { putCheckout, retrieveCheckoutAndCustomer, retrieveCheckoutPublicData } from "@/actions/checkout";
import { runAtomic } from "@/actions/event";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayment } from "@/actions/payment";
import { postSubscriptionsBulk } from "@/actions/subscription";
import { MS_PER_DAY, SENSITIVE_KEY_PREFIX, subscriptionPeriodMs, trialEndAt } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { getAssetUsdPrice, getFiatRates } from "@/integrations/price-feed";
import {
  buildSubscriptionApprovalXdr as soroban$buildSubscriptionApprovalXdr,
  retrieveSubscription as soroban$retrieveSubscription,
  startSubscription as soroban$startSubscription,
  verifySorobanTx as soroban$verifySorobanTx,
} from "@/integrations/soroban-contract";
import {
  SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE,
  buildPreSwapXdr,
  ensureTrustline,
  getChargesPublicKey,
  getCustomerAssetIssuers,
  getStellarConfig,
  retrieveAssetContractId,
} from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { BPS_DENOMINATOR, PLATFORM_FEE_BPS } from "@/lib/pricing";
import { generateResourceId } from "@/lib/utils";
import { Asset, BASE_FEE, Memo, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { SubscriptionData } from "@stellartools/core";
import Big from "big.js";
import moment from "moment";

/** Stellar max transaction lifetime (7 days). */
const STELLAR_MAX_TX_TIMEOUT_SEC = 604_800;

const MIN_CHECKOUT_TX_TIMEOUT_SEC = 120;

function checkoutTxTimeoutSeconds(expiresAt: Date): number {
  const remainingSec = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (remainingSec <= 0) throw new AppError("VALIDATION_ERROR", "Checkout has expired");
  return Math.min(Math.max(remainingSec, MIN_CHECKOUT_TX_TIMEOUT_SEC), STELLAR_MAX_TX_TIMEOUT_SEC);
}

export type OneTimePaymentParams = {
  checkoutId: string;
  customerPublicKey: string;
  sendAssetCode: string;
  sendAssetIssuer: string | null;
  sendMaxEstimate: string;
};

export const buildOneTimePaymentXdr = async (params: OneTimePaymentParams) => {
  const { checkoutId, customerPublicKey, sendAssetCode, sendAssetIssuer, sendMaxEstimate } = params;

  const checkout = await retrieveCheckoutAndCustomer(checkoutId);
  if (!checkout) return { error: "Checkout not found" };
  if (checkout.status !== "open") return { error: "Checkout is no longer open" };

  const txTimeout = checkoutTxTimeoutSeconds(checkout.expiresAt);

  const pub = await retrieveCheckoutPublicData(checkoutId);
  const fiatRate = pub?.fiatRates?.[checkout.currencyCode] ?? 1;
  const usdCents = checkout.finalAmount / fiatRate;

  const usdPrice = pub?.assetUsdPrices?.[sendAssetCode] ?? 0;
  const amount = usdPrice > 0 ? Money.calculateCryptoNeeded(usdCents, usdPrice) : sendMaxEstimate;

  const { server, passphrase } = getStellarConfig(checkout.environment);
  const account = await server.loadAccount(customerPublicKey).catch((e) => {
    throw new AppError(
      e.res?.status === 404 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
      e.res?.status === 404 ? "Account not found. Check network." : "Failed to load account"
    );
  });

  const asset = sendAssetCode === "XLM" ? Asset.native() : new Asset(sendAssetCode, sendAssetIssuer!);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase });

  const isDirect = checkout.walletStrategy === "direct";

  if (sendAssetIssuer) {
    const { secret: orgSecret } = await retrieveOrganizationIdAndSecret(checkout.organizationId, checkout.environment);

    if (orgSecret) {
      // Secret available (managed or self-custody with stored key): auto-set trustline.
      await ensureTrustline(
        decrypt(orgSecret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? ""),
        sendAssetCode,
        sendAssetIssuer,
        checkout.environment
      );
    } else {
      // No secret stored — merchant must have the trustline set up on their own.
      const merchantAccount = await server.loadAccount(checkout.merchantPublicKey).catch(() => null);
      const hasTrustline = merchantAccount?.balances.some(
        (b: any) => b.asset_code === sendAssetCode && b.asset_issuer === sendAssetIssuer
      );
      if (!hasTrustline) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Merchant wallet has no trustline for ${sendAssetCode}. Merchant should add it from their Stellar wallet to accept this asset.`
        );
      }
    }
  }

  if (isDirect) {
    // Split payment on-chain: merchant receives 99%, StellarTools fee receives 1%.
    const totalBig = new Big(amount);
    const feeAmount = totalBig.times(PLATFORM_FEE_BPS).div(BPS_DENOMINATOR).toFixed(7);
    const merchantAmount = totalBig.minus(new Big(feeAmount)).toFixed(7);

    builder.addOperation(
      Operation.payment({ destination: getChargesPublicKey(checkout.environment), asset, amount: feeAmount })
    );
    builder.addOperation(Operation.payment({ destination: checkout.merchantPublicKey, asset, amount: merchantAmount }));
  } else {
    builder.addOperation(Operation.payment({ destination: checkout.merchantPublicKey, asset, amount }));
  }

  return builder.addMemo(Memo.text(checkoutId)).setTimeout(txTimeout).build().toXDR();
};

export async function prepareSubscriptionApproval(
  checkoutId: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string | null
): Promise<
  | { xdr: string; periodStart: string; periodEnd: string; needsPreSwap: boolean; preSwapXdr?: string }
  | { error: string }
> {
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");
    if (checkout.status !== "open") return { error: "Checkout is no longer open" };
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };

    const txTimeout = checkoutTxTimeoutSeconds(checkout.expiresAt);

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const fiatRates = await getFiatRates();
    const fiatRate = fiatRates[checkout.currencyCode ?? "USD"] ?? 1;
    const finalAmountUsdCents = checkout.finalAmount / fiatRate;

    const [asset] = await retrieveSupportedAssets({ code: selectedAssetCode }, checkout.environment);
    const { amountRaw } = await Money.calculateSubscriptionAmount({
      priceCents: checkout.finalAmount,
      currencyCode: checkout.currencyCode ?? "USD",
      assetMetadata: asset?.metadata ?? {},
    });
    if (amountRaw <= BigInt(0)) return { error: `Unable to price subscription in ${selectedAssetCode}` };

    const neededStellarAmount = Money.centsToStellarString(finalAmountUsdCents);
    const totalAllowance = amountRaw * BigInt(200);

    const tokenContractId = await retrieveAssetContractId(
      selectedAssetCode,
      canonicalIssuer ?? "",
      checkout.environment
    );

    let needsPreSwap = false;
    let preSwapXdr: string | undefined;

    if (canonicalIssuer) {
      const heldIssuers = await getCustomerAssetIssuers(customerAddress, selectedAssetCode, checkout.environment);
      const hasCanonical = heldIssuers.includes(canonicalIssuer);

      if (!hasCanonical) {
        needsPreSwap = true;
        const xlmPrice = await getAssetUsdPrice({ coingeckoId: "stellar" });
        const xlmNeeded = Money.calculateCryptoNeeded(finalAmountUsdCents, xlmPrice);
        const sendMax = new Big(xlmNeeded).times(1.02).toFixed(7);

        preSwapXdr = await buildPreSwapXdr({
          customerPublicKey: customerAddress,
          sendAssetCode: "XLM",
          sendAssetIssuer: null,
          destAssetCode: selectedAssetCode,
          canonicalIssuer,
          neededStellarAmount,
          sendMax,
          network: checkout.environment,
          timeoutSeconds: txTimeout,
        });
      }
    }

    const durationMs = subscriptionPeriodMs(checkout.recurringPeriod, checkout.customDurationMs);
    if (!durationMs) return { error: "Invalid subscription billing period" };

    const trialDays =
      (checkout.subscriptionData as { trial_days?: number } | null)?.trial_days ??
      (typeof checkout.metadata?.trial_days === "number" ? checkout.metadata.trial_days : 0);
    const periodStart = new Date();
    const periodEnd = trialDays > 0 ? trialEndAt(periodStart, trialDays) : new Date(Date.now() + durationMs);

    const xdrResult = await soroban$buildSubscriptionApprovalXdr(checkout.environment, {
      customerAddress,
      tokenContractId,
      amount: totalAllowance,
      timeoutSeconds: txTimeout,
    });

    if (xdrResult.isErr()) return { error: xdrResult.error.message };

    return {
      xdr: xdrResult.value,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      needsPreSwap,
      preSwapXdr,
    };
  } catch (e: any) {
    return { error: e.message ?? "Failed to prepare approval" };
  }
}

export async function finalizeSubscriptionCheckout(
  checkoutId: string,
  approvalTxHash: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");

    const { status, productType, productId, merchantPublicKey, organizationId, environment, customerId } = checkout;

    if (status !== "open") return { success: false, error: "Checkout is not open" };
    if (productType !== "subscription") return { success: false, error: "Not a subscription checkout" };
    if (!selectedAssetCode || !productId || !merchantPublicKey || !customerId) {
      console.error("Missing required checkout data", {
        status,
        productType,
        productId,
        merchantPublicKey,
        customerId,
      });

      return { success: false, error: "Missing required checkout data" };
    }

    const durationMs = subscriptionPeriodMs(checkout.recurringPeriod, checkout.customDurationMs);
    if (!durationMs) return { success: false, error: "Invalid subscription billing period" };

    const trialDays =
      (checkout.subscriptionData as SubscriptionData | null)?.trial_days ??
      (typeof checkout.metadata?.trial_days === "number" ? checkout.metadata.trial_days : 0);
    const hasTrial = trialDays > 0;

    const verifyResult = await soroban$verifySorobanTx(environment, approvalTxHash);

    if (verifyResult.isErr()) {
      return { success: false, error: `Approval not confirmed: ${verifyResult.error.message}` };
    }

    const [asset] = await retrieveSupportedAssets({ code: selectedAssetCode }, environment);
    const { cryptoAmount, amountRaw } = await Money.calculateSubscriptionAmount({
      priceCents: checkout.finalAmount,
      currencyCode: checkout.currencyCode ?? "USD",
      assetMetadata: asset?.metadata ?? {},
    });
    if (amountRaw <= BigInt(0))
      return { success: false, error: `Unable to price subscription in ${selectedAssetCode}` };

    const tokenContractId = await retrieveAssetContractId(selectedAssetCode, selectedAssetIssuer, checkout.environment);

    const existingSub = await soroban$retrieveSubscription(environment, customerAddress, productId);
    if (existingSub.isOk()) {
      const status = existingSub.value.status;
      if (status === "active" || status === "paused") {
        return { success: false, error: SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE };
      }
    }

    const startResult = await soroban$startSubscription(environment, {
      customerAddress,
      merchantAddress: merchantPublicKey,
      tokenContractId,
      productId,
      amountRaw,
      durationMs: hasTrial ? trialDays * MS_PER_DAY : durationMs,
    });

    if (startResult.isErr()) {
      return { success: false, error: startResult.error.message };
    }

    const { hash } = startResult.value;
    const subscriptionId = generateResourceId("sub", checkout.organizationId, 20);
    const periodStart = new Date();
    const periodEnd = hasTrial ? trialEndAt(periodStart, trialDays) : new Date(Date.now() + durationMs);

    await runAtomic(async () => {
      await putCheckout(checkoutId, { status: "completed", updatedAt: new Date() }, organizationId, environment);

      await postSubscriptionsBulk(
        {
          id: subscriptionId,
          customerId,
          productId: productId!,
          status: hasTrial ? "trialing" : "active",
          period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
          cancelAtPeriodEnd: checkout.subscriptionData?.cancel_at_period_end ?? false,
          metadata: null,
          trialDays: hasTrial ? trialDays : 0,
          customerWalletAddress: customerAddress,
        },
        organizationId,
        environment
      );

      await postPayment(
        {
          customerId: checkout.customerId,
          checkoutId,
          productId: checkout.productId ?? null,
          amountCents: checkout.finalAmount,
          currencyCode: checkout.currencyCode ?? "USD",
          cryptoAmount,
          selectedAssetCode,
          selectedAssetIssuer,
          transactionHash: hash,
          status: "confirmed",
          metadata: null,
          subscriptionId,
          failureReason: null,
        },
        organizationId,
        environment,
        { customerWalletAddress: customerAddress }
      );
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to finalize subscription" };
  }
}
