"use server";

import { putCheckout, retrieveCheckoutAndCustomer } from "@/actions/checkout";
import { runAtomic } from "@/actions/event";
import { postPayment } from "@/actions/payment";
import { postSubscriptionsBulk } from "@/actions/subscription";
import { subscriptionIntervals } from "@/constant";
import { getAssetUsdPrice } from "@/integrations/price-feed";
import { buildSubscriptionApprovalXdr, startSubscription, submitSorobanTx } from "@/integrations/soroban-contract";
import { retrieveAssetContractId } from "@/integrations/stellar-core";
import { generateResourceId, xlmToStroops } from "@/lib/utils";
import moment from "moment";

/**
 * Builds a prepared (simulated) Soroban `approve` transaction XDR for the customer to sign.
 * This grants the subscription engine contract permission to charge the customer's token balance.
 * Returns the XDR string that the wallet must sign.
 */
export async function prepareSubscriptionApproval(
  checkoutId: string,
  customerAddress: string
): Promise<{ xdr: string; periodStart: string; periodEnd: string } | { error: string }> {
  try {
    const checkout = await retrieveCheckoutAndCustomer(checkoutId);

    if (!checkout) throw new Error("Checkout not found");

    if (checkout.productType !== "subscription") {
      return { error: "Not a subscription checkout" };
    }

    if (!checkout.assetCode) {
      return { error: "Asset not configured for this checkout" };
    }

    const tokenContractId = await retrieveAssetContractId(
      checkout.assetCode,
      checkout.assetIssuer!,
      checkout.environment
    );

    const durationDays = subscriptionIntervals[checkout.recurringPeriod as keyof typeof subscriptionIntervals] ?? 30;
    const amountStroops = xlmToStroops(checkout.finalAmount.toString());

    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + durationDays * 864e5);

    // Approve 200 periods worth of allowance so recurring charges work without re-approval
    const totalAllowance = amountStroops * BigInt(200);

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
    };
  } catch (e: any) {
    return { error: e.message ?? "Failed to prepare approval" };
  }
}

/**
 * Submits the customer-signed approval tx, then calls `start` on the subscription engine
 * (backend-signed), which executes the first payment via transfer_from.
 * Finally records the payment + subscription and marks the checkout complete.
 */
export async function finalizeSubscriptionCheckout(
  checkoutId: string,
  signedApprovalXDR: string,
  customerAddress: string
): Promise<{ success: boolean; error?: string }> {
  const checkout = await retrieveCheckoutAndCustomer(checkoutId);

  if (!checkout) throw new Error("Checkout not found");

  const {
    status,
    productType,
    assetCode,
    productId,
    merchantPublicKey,
    organizationId,
    environment,
    customerId,
    subscriptionData,
  } = checkout;

  if (status !== "open") {
    return { success: false, error: "Checkout is not open" };
  }

  if (productType !== "subscription") {
    return { success: false, error: "Not a subscription checkout" };
  }

  if (!assetCode || !productId || !merchantPublicKey || !customerId) {
    return { success: false, error: "Missing required checkout data" };
  }

  if (!subscriptionData?.period_start || !subscriptionData?.period_end) {
    return { success: false, error: "Period data missing - call prepareSubscriptionApproval first" };
  }

  const tokenContractId = await retrieveAssetContractId(assetCode, checkout.assetIssuer!, checkout.environment);
  const durationDays = subscriptionIntervals[checkout.recurringPeriod as keyof typeof subscriptionIntervals] ?? 30;

  const durationSeconds = durationDays * 86400;
  const amountStroops = xlmToStroops(checkout.finalAmount.toString());

  const approvalResult = await submitSorobanTx(checkout.environment, signedApprovalXDR);
  if (approvalResult.isErr()) {
    return { success: false, error: `Approval failed: ${approvalResult.error.message}` };
  }

  const startResult = await startSubscription(checkout.environment, process.env.KEEPER_SECRET!, {
    customerAddress,
    merchantAddress: merchantPublicKey,
    tokenContractId,
    productId,
    amountStroops,
    durationSeconds,
  });

  if (startResult.isErr()) {
    return { success: false, error: `Subscription start failed: ${startResult.error.message}` };
  }

  const { hash } = startResult.value;

  const subscriptionId = generateResourceId("sub", checkout.organizationId, 20);

  await runAtomic(async () => {
    await putCheckout(checkoutId, { status: "completed", updatedAt: new Date() }, organizationId, environment);

    await postSubscriptionsBulk(
      {
        id: subscriptionId,
        customerIds: [customerId],
        productId: productId!,
        period: { from: moment().toISOString(), to: moment().add(durationDays, "days").toISOString() },
        cancelAtPeriodEnd: false,
        metadata: null,
      },
      organizationId,
      environment
    );

    const amountUsdCentsSnapshot = BigInt(
      Math.round((await getAssetUsdPrice(checkout.assetMetadata ?? {})) * checkout.finalAmount) * 100
    );

    console.log("amountUsdCentsSnapshot", amountUsdCentsSnapshot);

    await postPayment(
      {
        customerId: checkout.customerId,
        checkoutId,
        amount: xlmToStroops(checkout.finalAmount.toString()),
        transactionHash: hash,
        status: "confirmed",
        metadata: null,
        assetId: checkout.assetId,
        subscriptionId,
        amountUsdCentsSnapshot,
      },
      organizationId,
      environment,
      {
        assetId: checkout.assetId ?? undefined,
        assetCode: checkout.assetCode ?? undefined,
        customerWalletAddress: customerAddress,
      }
    );
  });

  return { success: true };
}
