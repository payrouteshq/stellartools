"use server";

import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrievePayments } from "@/actions/payment";
import { Network, charges, db } from "@/db";
import { decrypt } from "@/integrations/encryption";
import { sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/error-handler";
import { BPS_DENOMINATOR, FREE_THRESHOLD_USD, getVolumeTierRateBps } from "@/lib/pricing";
import { generateResourceId } from "@/lib/utils";

export async function processPaymentBilling(
  paymentId: string,
  organizationId: string,
  environment: Network,
  lifeTimeVolumeUsdCents: number
) {
  console.log("Processing payment billing for payment", paymentId);

  const [payment, secret] = await Promise.all([
    retrievePayments(organizationId, environment, { paymentId, limit: 1 }, { withAsset: true }).then(
      (res) => res.data[0]
    ),
    retrieveOrganizationIdAndSecret(organizationId, environment).then((res) => res.secret),
  ]);

  if (!payment || payment.status !== "confirmed") return;

  if (!secret || !payment || !payment.asset) {
    console.error("One of secret, payment, or asset is missing for payment", paymentId);
    throw new AppError(`One of secret, payment, or asset is missing for payment ${paymentId}`);
  }

  const paymentValueCents = Number(payment.amountUsdCentsSnapshot);

  console.log("Payment value cents", paymentValueCents);

  const lifetimeVolumeUsd = lifeTimeVolumeUsdCents / 100;

  console.log("Lifetime volume USD", lifetimeVolumeUsd);

  if (lifetimeVolumeUsd <= FREE_THRESHOLD_USD) {
    console.log("✓ Free tier, skipping charges..");
    return;
  }

  const rateBps = getVolumeTierRateBps(lifetimeVolumeUsd);

  console.log("Rate BPS", rateBps);

  if (rateBps === 0) return;

  const feeStroops = (payment.amount * BigInt(rateBps)) / BigInt(BPS_DENOMINATOR);
  const feeUsdCents = (feeStroops * BigInt(paymentValueCents)) / BigInt(1e7);

  const chargeId = generateResourceId("ch", paymentId, 20);

  console.log("Fee Stroops", feeStroops);
  console.log("Fee USD Cents", feeUsdCents);

  try {
    const secretKey = decrypt(secret.encrypted);
    const keeperKey = process.env.CHARGES_PUBLIC_KEY!;

    const res = await sendAssetPayment(
      secretKey,
      keeperKey,
      payment.asset.code,
      payment.asset.issuer!,
      feeStroops.toString(),
      payment.environment,
      `Fee: ${paymentId}`
    );

    console.log("Charge result", res);

    await db.insert(charges).values({
      id: chargeId,
      organizationId: payment.organizationId,
      paymentId: payment.id,
      amount: feeStroops,
      amountUsdCents: feeUsdCents,
      assetId: payment.asset.id,
      type: "platform_fee",
      status: res.isOk() ? "succeeded" : "failed",
      transactionHash: res.isOk() ? res.value?.hash : null,
      error: res.isErr() ? res.error.message : null,
      environment: payment.environment,
    });
  } catch (err: any) {
    console.error("[Billing Error]", err);
  }
}
