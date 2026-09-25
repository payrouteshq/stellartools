"use server";

import { putCheckout, retrieveCheckoutAndCustomer, retrieveCheckoutPublicData } from "@/actions/checkout";
import { runAtomic } from "@/actions/event";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayment } from "@/actions/payment";
import { postSubscriptionsBulk } from "@/actions/subscription";
import { MS_PER_DAY, SENSITIVE_KEY_PREFIX, subscriptionPeriodMs, trialEndAt } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { getFiatRates } from "@/integrations/price-feed";
import {
  buildSubscriptionApprovalXdr as soroban$buildSubscriptionApprovalXdr,
  buildSubscriptionStartXdr as soroban$buildSubscriptionStartXdr,
  retrieveSubscription as soroban$retrieveSubscription,
  verifySorobanTx as soroban$verifySorobanTx,
} from "@/integrations/soroban-contract";
import {
  SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE,
  buildPreSwapXdr,
  ensureTrustline,
  getChargesPublicKey,
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

  // USDC is always $1 — amount = USD cents / 100.
  const amount: string = Money.calculateCryptoNeeded(usdCents, 1);

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
      await ensureTrustline(
        decrypt(orgSecret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? ""),
        sendAssetCode,
        sendAssetIssuer,
        checkout.environment
      );
    } else {
      const merchantAccount = await server.loadAccount(checkout.merchantPublicKey).catch(() => null);
      const hasTrustline = merchantAccount?.balances.some(
        (b: any) => b.asset_code === sendAssetCode && b.asset_issuer === sendAssetIssuer
      );
      if (!hasTrustline) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Merchant wallet has no trustline for ${sendAssetCode}. Add it from your Stellar wallet to accept this asset.`
        );
      }
    }
  }

  // Always use path finding — Stellar's DEX handles any issuer mismatch, partial balances,
  // and non-USDC holdings automatically. If the customer has canonical USDC, the path finder
  // returns source=USDC path=[] which is a zero-hop direct transfer.
  const pathsResult = await server.strictReceivePaths(customerPublicKey, asset, amount).call();

  if (pathsResult.records.length === 0) {
    throw new AppError("VALIDATION_ERROR", `No payment route found. Add USDC or XLM to your wallet to continue.`);
  }

  const best = pathsResult.records[0] as any;
  const pathSourceAsset =
    best.source_asset_type === "native"
      ? Asset.native()
      : new Asset(best.source_asset_code!, best.source_asset_issuer!);
  const pathSendMax = new Big(best.source_amount).times(1.01).toFixed(7);
  const pathIntermediates = (best.path ?? []).map((p: any) =>
    p.asset_type === "native" ? Asset.native() : new Asset(p.asset_code!, p.asset_issuer!)
  );

  if (isDirect) {
    const totalBig: Big = new Big(amount);
    const feeAmount = totalBig.times(PLATFORM_FEE_BPS).div(BPS_DENOMINATOR).toFixed(7);
    const merchantAmount = totalBig.minus(new Big(feeAmount)).toFixed(7);
    const sendMaxBig = new Big(pathSendMax);
    const feeSendMax = sendMaxBig.times(new Big(feeAmount)).div(totalBig).times(1.02).toFixed(7);
    const merchantSendMax = sendMaxBig.times(new Big(merchantAmount)).div(totalBig).times(1.02).toFixed(7);
    builder
      .addOperation(
        Operation.pathPaymentStrictReceive({
          sendAsset: pathSourceAsset,
          sendMax: feeSendMax,
          destination: getChargesPublicKey(checkout.environment),
          destAsset: asset,
          destAmount: feeAmount,
          path: pathIntermediates,
        })
      )
      .addOperation(
        Operation.pathPaymentStrictReceive({
          sendAsset: pathSourceAsset,
          sendMax: merchantSendMax,
          destination: checkout.merchantPublicKey,
          destAsset: asset,
          destAmount: merchantAmount,
          path: pathIntermediates,
        })
      );
  } else {
    builder.addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: pathSourceAsset,
        sendMax: pathSendMax,
        destination: checkout.merchantPublicKey,
        destAsset: asset,
        destAmount: amount,
        path: pathIntermediates,
      })
    );
  }

  return builder.addMemo(Memo.text(checkoutId)).setTimeout(txTimeout).build().toXDR();
};

const NATIVE_RESERVE_BUFFER = "5";
const MAX_QUOTABLE_PERIODS = 24;

export async function quoteSubscriptionPeriods(
  checkoutId: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string | null
): Promise<
  | {
      perPeriodAmount: string;
      sourceAssetCode: string;
      sourceAssetIssuer: string | null;
      maxAffordablePeriods: number;
    }
  | { error: string }
> {
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    if (!checkout) return { error: "Checkout not found" };
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const fiatRates = await getFiatRates();
    const fiatRate = fiatRates[checkout.currencyCode ?? "USD"] ?? 1;
    const finalAmountUsdCents = checkout.finalAmount / fiatRate;
    const perPeriodAmount = Money.centsToStellarString(finalAmountUsdCents);

    const { server } = getStellarConfig(checkout.environment);
    const account = await server.loadAccount(customerAddress);

    if (!canonicalIssuer) {
      // Paying in XLM directly — no swap involved, just check the native balance.
      const nativeBalance = account.balances.find((b: any) => b.asset_type === "native");
      const available = nativeBalance ? new Big(nativeBalance.balance).minus(NATIVE_RESERVE_BUFFER) : new Big(0);
      const maxAffordablePeriods = available.lte(0)
        ? 0
        : Math.min(MAX_QUOTABLE_PERIODS, Math.floor(available.div(perPeriodAmount).toNumber()));
      return { perPeriodAmount, sourceAssetCode: "XLM", sourceAssetIssuer: null, maxAffordablePeriods };
    }

    const destAsset = new Asset(selectedAssetCode, canonicalIssuer);
    const onePeriodPaths = await server.strictReceivePaths(customerAddress, destAsset, perPeriodAmount).call();

    if (onePeriodPaths.records.length === 0) {
      return {
        perPeriodAmount,
        sourceAssetCode: selectedAssetCode,
        sourceAssetIssuer: canonicalIssuer,
        maxAffordablePeriods: 0,
      };
    }

    const best = onePeriodPaths.records[0] as any;
    const sourceAssetCode = best.source_asset_type === "native" ? "XLM" : best.source_asset_code!;
    const sourceAssetIssuer = best.source_asset_type === "native" ? null : (best.source_asset_issuer ?? null);
    const sourceAsset =
      best.source_asset_type === "native" ? Asset.native() : new Asset(sourceAssetCode, sourceAssetIssuer!);

    const sourceBalanceEntry =
      best.source_asset_type === "native"
        ? account.balances.find((b: any) => b.asset_type === "native")
        : account.balances.find((b: any) => b.asset_code === sourceAssetCode && b.asset_issuer === sourceAssetIssuer);

    if (!sourceBalanceEntry) {
      return { perPeriodAmount, sourceAssetCode, sourceAssetIssuer, maxAffordablePeriods: 0 };
    }

    let availableSource = new Big(sourceBalanceEntry.balance);
    if (best.source_asset_type === "native") {
      availableSource = availableSource.minus(NATIVE_RESERVE_BUFFER);
    }
    if (availableSource.lte(0)) {
      return { perPeriodAmount, sourceAssetCode, sourceAssetIssuer, maxAffordablePeriods: 0 };
    }

    // How much of the destination asset can this source balance actually
    // reach via the DEX? Uses a real quote rather than assuming the one-period
    // exchange rate holds linearly at larger sizes.
    const sendResult = await server.strictSendPaths(sourceAsset, availableSource.toFixed(7), [destAsset]).call();
    const bestSend = sendResult.records[0] as any;
    const maxDestAmount = bestSend ? new Big(bestSend.destination_amount) : new Big(0);
    const maxAffordablePeriods = Math.min(
      MAX_QUOTABLE_PERIODS,
      Math.max(0, Math.floor(maxDestAmount.div(perPeriodAmount).toNumber()))
    );

    return { perPeriodAmount, sourceAssetCode, sourceAssetIssuer, maxAffordablePeriods };
  } catch (e: any) {
    return { error: e.message ?? "Failed to quote billing periods" };
  }
}

export async function prepareSubscriptionSwap(
  checkoutId: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string | null,
  periods: number = 1
): Promise<{ needsPreSwap: boolean; preSwapXdr?: string } | { error: string }> {
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[timing:prepareSubscriptionSwap] ${label}: ${Date.now() - t0}ms`);
  try {
    if (!Number.isInteger(periods) || periods < 1) return { error: "Invalid number of billing periods" };

    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    lap("retrieveCheckoutAndCustomer");
    if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");
    if (checkout.status !== "open") return { error: "Checkout is no longer open" };
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };
    if (!checkout.productId || !checkout.merchantPublicKey) return { error: "Missing required checkout data" };

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const [existingSub, fiatRates] = await Promise.all([
      soroban$retrieveSubscription(
        checkout.environment,
        customerAddress,
        checkout.merchantPublicKey,
        checkout.productId
      ),
      canonicalIssuer ? getFiatRates() : Promise.resolve(undefined),
    ]);
    lap("soroban$retrieveSubscription+getFiatRates");
    if (existingSub.isOk()) {
      const status = existingSub.value.status;
      if (status === "active" || status === "paused") {
        return { error: SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE };
      }
    }

    if (!canonicalIssuer) return { needsPreSwap: false };

    const txTimeout = checkoutTxTimeoutSeconds(checkout.expiresAt);
    const fiatRate = fiatRates![checkout.currencyCode ?? "USD"] ?? 1;
    const finalAmountUsdCents = checkout.finalAmount / fiatRate;

    const neededStellarAmount = Money.centsToStellarString(finalAmountUsdCents * periods);

    const { server } = getStellarConfig(checkout.environment);
    const destAssetForPath = new Asset(selectedAssetCode, canonicalIssuer);
    const pathsResult = await server.strictReceivePaths(customerAddress, destAssetForPath, neededStellarAmount).call();
    lap("strictReceivePaths");

    if (pathsResult.records.length === 0) {
      return { error: `No payment route found. Add USDC or XLM to your wallet to continue.` };
    }

    const best = pathsResult.records[0] as any;
    const swapSourceCode = best.source_asset_type === "native" ? "XLM" : best.source_asset_code!;
    const swapSourceIssuer = best.source_asset_type === "native" ? null : (best.source_asset_issuer ?? null);
    const isSameAsset = swapSourceCode === selectedAssetCode && swapSourceIssuer === canonicalIssuer;

    if (isSameAsset) return { needsPreSwap: false };

    const swapSendMax = new Big(best.source_amount).times(1.01).toFixed(7);
    const swapIntermediates = (best.path ?? []).map((p: any) =>
      p.asset_type === "native" ? Asset.native() : new Asset(p.asset_code!, p.asset_issuer!)
    );
    const preSwapXdr = await buildPreSwapXdr({
      customerPublicKey: customerAddress,
      sendAssetCode: swapSourceCode,
      sendAssetIssuer: swapSourceIssuer,
      destAssetCode: selectedAssetCode,
      canonicalIssuer,
      neededStellarAmount,
      sendMax: swapSendMax,
      path: swapIntermediates,
      network: checkout.environment,
      timeoutSeconds: txTimeout,
    });
    lap("buildPreSwapXdr");

    return { needsPreSwap: true, preSwapXdr };
  } catch (e: any) {
    lap(`threw: ${e.message}`);
    return { error: e.message ?? "Failed to prepare swap" };
  }
}

export async function prepareSubscriptionApproval(
  checkoutId: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string | null
): Promise<{ xdr: string } | { error: string }> {
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[timing:prepareSubscriptionApproval] ${label}: ${Date.now() - t0}ms`);
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    lap("retrieveCheckoutAndCustomer");
    if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");
    if (checkout.status !== "open") return { error: "Checkout is no longer open" };
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };
    if (!checkout.productId || !checkout.merchantPublicKey) return { error: "Missing required checkout data" };

    // The existing-subscription check already ran in prepareSubscriptionSwap
    // moments earlier in this same checkout flow — no need to repeat it here.

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const txTimeout = checkoutTxTimeoutSeconds(checkout.expiresAt);

    const { amountRaw } = await Money.calculateSubscriptionAmount({
      priceCents: checkout.finalAmount,
      currencyCode: checkout.currencyCode ?? "USD",
      assetMetadata: { usdPeg: true },
    });
    lap("Money.calculateSubscriptionAmount");
    if (amountRaw <= BigInt(0)) return { error: `Unable to price subscription in ${selectedAssetCode}` };

    const totalAllowance = amountRaw * BigInt(200);

    const tokenContractId = await retrieveAssetContractId(
      selectedAssetCode,
      canonicalIssuer ?? "",
      checkout.environment
    );
    lap("retrieveAssetContractId");

    const xdrResult = await soroban$buildSubscriptionApprovalXdr(checkout.environment, {
      customerAddress,
      tokenContractId,
      amount: totalAllowance,
      timeoutSeconds: txTimeout,
    });
    lap("buildSubscriptionApprovalXdr");

    if (xdrResult.isErr()) return { error: xdrResult.error.message };

    return { xdr: xdrResult.value };
  } catch (e: any) {
    lap(`threw: ${e.message}`);
    return { error: e.message ?? "Failed to prepare approval" };
  }
}

/**
 * Builds the `start` transaction. Must be called *after* the approval
 * transaction has confirmed on-chain — building it any earlier reads the same
 * account sequence number the approval already consumed, and the wallet's
 * submission gets rejected as tx_bad_seq.
 */
export async function prepareSubscriptionStart(
  checkoutId: string,
  customerAddress: string,
  selectedAssetCode: string,
  selectedAssetIssuer: string | null
): Promise<{ startXdr: string } | { error: string }> {
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[timing:prepareSubscriptionStart] ${label}: ${Date.now() - t0}ms`);
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);
    lap("retrieveCheckoutAndCustomer");
    if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");
    if (checkout.status !== "open") return { error: "Checkout is no longer open" };
    if (checkout.productType !== "subscription") return { error: "Not a subscription checkout" };
    if (!selectedAssetCode) return { error: "No payment asset selected" };
    if (!checkout.productId || !checkout.merchantPublicKey) return { error: "Missing required checkout data" };

    const canonicalIssuer = selectedAssetIssuer;
    if (!canonicalIssuer && selectedAssetCode.toUpperCase() !== "XLM") {
      return { error: `No canonical issuer available for ${selectedAssetCode}` };
    }

    const txTimeout = checkoutTxTimeoutSeconds(checkout.expiresAt);

    const { amountRaw } = await Money.calculateSubscriptionAmount({
      priceCents: checkout.finalAmount,
      currencyCode: checkout.currencyCode ?? "USD",
      assetMetadata: { usdPeg: true },
    });
    lap("Money.calculateSubscriptionAmount");
    if (amountRaw <= BigInt(0)) return { error: `Unable to price subscription in ${selectedAssetCode}` };

    const tokenContractId = await retrieveAssetContractId(
      selectedAssetCode,
      canonicalIssuer ?? "",
      checkout.environment
    );
    lap("retrieveAssetContractId");

    const durationMs = subscriptionPeriodMs(checkout.recurringPeriod, checkout.customDurationMs);
    if (!durationMs) return { error: "Invalid subscription billing period" };

    const trialDays =
      (checkout.subscriptionData as { trial_days?: number } | null)?.trial_days ??
      (typeof checkout.metadata?.trial_days === "number" ? checkout.metadata.trial_days : 0);

    const startXdrResult = await soroban$buildSubscriptionStartXdr(checkout.environment, {
      customerAddress,
      merchantAddress: checkout.merchantPublicKey,
      tokenContractId,
      productId: checkout.productId,
      amountRaw,
      durationMs: trialDays > 0 ? trialDays * MS_PER_DAY : durationMs,
      timeoutSeconds: txTimeout,
    });
    lap("buildSubscriptionStartXdr");

    if (startXdrResult.isErr()) return { error: startXdrResult.error.message };

    return { startXdr: startXdrResult.value };
  } catch (e: any) {
    lap(`threw: ${e.message}`);
    return { error: e.message ?? "Failed to prepare start" };
  }
}

export async function finalizeSubscriptionCheckout(
  checkoutId: string,
  approvalTxHash: string,
  startTxHash: string,
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

    // Both the allowance approval and the `start` call are signed and
    // submitted by the customer's own wallet — the contract requires the
    // customer's own authorization to open a subscription in their name, so
    // the backend never invokes `start` on their behalf. We just verify both
    // landed on-chain before recording the subscription.
    const [verifyApproval, verifyStart] = await Promise.all([
      soroban$verifySorobanTx(environment, approvalTxHash),
      soroban$verifySorobanTx(environment, startTxHash),
    ]);

    if (verifyApproval.isErr()) {
      return { success: false, error: `Approval not confirmed: ${verifyApproval.error.message}` };
    }
    if (verifyStart.isErr()) {
      return { success: false, error: `Subscription start not confirmed: ${verifyStart.error.message}` };
    }

    const { cryptoAmount } = await Money.calculateSubscriptionAmount({
      priceCents: checkout.finalAmount,
      currencyCode: checkout.currencyCode ?? "USD",
      assetMetadata: { usdPeg: true },
    });

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
          transactionHash: startTxHash,
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
