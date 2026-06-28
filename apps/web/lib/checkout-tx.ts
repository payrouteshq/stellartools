"use server";

import { putCheckout, retrieveCheckoutAndCustomer, retrieveCheckoutPublicData } from "@/actions/checkout";
import { runAtomic } from "@/actions/event";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayment } from "@/actions/payment";
import { postSubscriptionsBulk } from "@/actions/subscription";
import { SENSITIVE_KEY_PREFIX, STELLAR_PRECISION, subscriptionIntervals } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { getAssetUsdPrice, getFiatRates } from "@/integrations/price-feed";
import { buildSubscriptionApprovalXdr, startSubscription, submitSorobanTx } from "@/integrations/soroban-contract";
import {
  buildPreSwapXdr,
  ensureTrustline,
  getCustomerAssetIssuers,
  getStellarConfig,
  retrieveAssetContractId,
} from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { generateResourceId } from "@/lib/utils";
import { Asset, BASE_FEE, Memo, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import Big from "big.js";
import moment from "moment";

const toRawUnits = (decimalAmount: string): bigint =>
  BigInt(Math.round(Number(decimalAmount) * 10 ** STELLAR_PRECISION));

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

  const pub = await retrieveCheckoutPublicData(checkoutId);
  const fiatRate = pub?.fiatRates?.[checkout.currencyCode] ?? 1;
  const usdCents = checkout.finalAmount / fiatRate;

  const usdPrice = pub?.assetUsdPrices?.[sendAssetCode] ?? 0;
  const amount = usdPrice > 0 ? Money.calculateCryptoNeeded(usdCents, usdPrice) : sendMaxEstimate;

  const { server, passphrase } = getStellarConfig(checkout.environment);
  const account = await server.loadAccount(customerPublicKey).catch((e) => {
    throw new AppError(e.res?.status === 404 ? "Account not found. Check network." : "Failed to load account");
  });

  const asset = sendAssetCode === "XLM" ? Asset.native() : new Asset(sendAssetCode, sendAssetIssuer!);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase });

  // For non-native payments, ensure the merchant's wallet has a trustline for
  // the exact asset the customer is sending before the payment can land there.
  if (sendAssetIssuer) {
    const { secret: orgSecret } = await retrieveOrganizationIdAndSecret(checkout.organizationId, checkout.environment);
    if (!orgSecret) throw new AppError("Merchant wallet not configured");
    await ensureTrustline(
      decrypt(orgSecret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? ""),
      sendAssetCode,
      sendAssetIssuer,
      checkout.environment
    );
  }

  builder.addOperation(Operation.payment({ destination: checkout.merchantPublicKey, asset, amount }));

  return builder.addMemo(Memo.text(checkoutId)).setTimeout(30).build().toXDR();
};

// ── Subscription ─────────────────────────────────────────────────────────────

/**
 * Builds a prepared Soroban `approve` transaction XDR for the customer to sign.
 * Also returns a pre-swap XDR if the customer doesn't hold the canonical token yet.
 */
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
    if (!checkout) throw new AppError("Checkout not found");
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const fiatRates = await getFiatRates();
    const fiatRate = fiatRates[checkout.currencyCode ?? "USD"] ?? 1;
    const finalAmountUsdCents = checkout.finalAmount / fiatRate;

    const assetUsdPrice = await getAssetUsdPrice({ coingeckoId: selectedAssetCode.toLowerCase() });
    const cryptoAmount = Money.calculateCryptoNeeded(finalAmountUsdCents, assetUsdPrice);
    const neededStellarAmount = Money.centsToStellarString(finalAmountUsdCents);
    const amountRaw = toRawUnits(cryptoAmount);
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
        });
      }
    }

    let durationDays: number = 0;

    if (checkout.recurringPeriod == "custom") {
      durationDays = checkout.customDurationMs ? Math.round(checkout.customDurationMs / 864e5) : 0;
    } else {
      durationDays = subscriptionIntervals[checkout.recurringPeriod as keyof typeof subscriptionIntervals] ?? 30;
    }

    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + durationDays * 864e5);

    const xdrResult = await buildSubscriptionApprovalXdr(checkout.environment, {
      customerAddress,
      tokenContractId,
      amount: totalAllowance,
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

/**
 * Submits the customer-signed approval tx, calls `start` on the subscription engine,
 * then records the payment + subscription and marks the checkout complete.
 */
export async function finalizeSubscriptionCheckout(
  checkoutId: string,
  signedApprovalXDR: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string
): Promise<{ success: boolean; error?: string }> {
  const checkout = await retrieveCheckoutAndCustomer(checkoutId);
  if (!checkout) throw new AppError("Checkout not found");

  const {
    status,
    productType,
    productId,
    merchantPublicKey,
    organizationId,
    environment,
    customerId,
    subscriptionData,
  } = checkout;

  if (status !== "open") return { success: false, error: "Checkout is not open" };
  if (productType !== "subscription") return { success: false, error: "Not a subscription checkout" };
  if (!selectedAssetCode || !productId || !merchantPublicKey || !customerId) {
    return { success: false, error: "Missing required checkout data" };
  }
  if (!subscriptionData?.period_start || !subscriptionData?.period_end) {
    return { success: false, error: "Period data missing — call prepareSubscriptionApproval first" };
  }

  const tokenContractId = await retrieveAssetContractId(selectedAssetCode, selectedAssetIssuer, checkout.environment);

  let durationDays: number = 0;

  if (checkout.recurringPeriod == "custom") {
    durationDays = checkout.customDurationMs ? Math.round(checkout.customDurationMs / 864e5) : 0;
  } else {
    durationDays = subscriptionIntervals[checkout.recurringPeriod as keyof typeof subscriptionIntervals] ?? 30;
  }

  const approvalResult = await submitSorobanTx(checkout.environment, signedApprovalXDR);
  if (approvalResult.isErr()) {
    return { success: false, error: `Approval failed: ${approvalResult.error.message}` };
  }

  const startResult = await startSubscription(checkout.environment, process.env.KEEPER_SECRET!, {
    customerAddress,
    merchantAddress: merchantPublicKey,
    tokenContractId,
    productId,
    amountCents: checkout.finalAmount,
    durationSeconds: durationDays * 86400,
  });

  if (startResult.isErr()) {
    return { success: false, error: `Subscription start failed: ${startResult.error.message}` };
  }

  const { hash } = startResult.value;
  const subscriptionId = generateResourceId("sub", checkout.organizationId, 20);

  const fiatRates = await getFiatRates();
  const fiatRate = fiatRates[checkout.currencyCode ?? "USD"] ?? 1;
  const finalAmountUsdCents = checkout.finalAmount / fiatRate;
  const assetUsdPrice = await getAssetUsdPrice({ coingeckoId: selectedAssetCode.toLowerCase() });
  const cryptoAmount = Money.calculateCryptoNeeded(finalAmountUsdCents, assetUsdPrice);

  await runAtomic(async () => {
    await putCheckout(checkoutId, { status: "completed", updatedAt: new Date() }, organizationId, environment);

    await postSubscriptionsBulk(
      {
        id: subscriptionId,
        customerIds: [customerId],
        productId: productId!,
        priceCents: checkout.finalAmount,
        period: { from: moment().toISOString(), to: moment().add(durationDays, "days").toISOString() },
        cancelAtPeriodEnd: false,
        metadata: null,
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
}
