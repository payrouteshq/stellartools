"use server";

import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrievePayments } from "@/actions/payment";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Network, charges, db } from "@/db";
import { decrypt } from "@/integrations/encryption";
import { sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { BPS_DENOMINATOR, PLATFORM_FEE_BPS } from "@/lib/pricing";
import { generateResourceId } from "@/lib/utils";

export async function processPaymentBilling(paymentId: string, organizationId: string, environment: Network) {
  const [payment, secret] = await Promise.all([
    retrievePayments(organizationId, environment, { paymentId, limit: 1 }).then((res) => res.data[0]),
    retrieveOrganizationIdAndSecret(organizationId, environment).then((res) => res.secret),
  ]);

  if (!payment || payment.status !== "confirmed") return;

  if (!secret || !payment.selectedAssetCode) {
    throw new AppError(`Missing secret or asset for payment ${paymentId}`);
  }

  const feeCryptoAmount = (Number(payment.cryptoAmount) * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const feeAmountCents = Math.round((payment.amountCents * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
  const chargeId = generateResourceId("ch", paymentId, 20);

  try {
    const secretKey = decrypt(secret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? "");

    const res = await sendAssetPayment(
      secretKey,
      process.env.CHARGES_PUBLIC_KEY!,
      payment.selectedAssetCode,
      payment.selectedAssetIssuer!,
      feeCryptoAmount.toFixed(7),
      payment.environment,
      chargeId
    );

    await db.insert(charges).values({
      id: chargeId,
      organizationId: payment.organizationId,
      paymentId: payment.id,
      amountCents: feeAmountCents,
      currencyCode: payment.currencyCode,
      cryptoAmount: feeCryptoAmount.toFixed(7),
      selectedAssetCode: payment.selectedAssetCode,
      selectedAssetIssuer: payment.selectedAssetIssuer,
      type: "platform_fee",
      status: res.isOk() ? "succeeded" : "failed",
      transactionHash: res.isOk() ? res.value?.hash : null,
      error: res.isErr() ? res.error.message : null,
      environment: payment.environment,
      createdAt: new Date(),
    });
  } catch (err: any) {
    console.error("[Billing Error]", err);
  }
}
