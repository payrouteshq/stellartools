import { retrieveCharges } from "@/actions/charges";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrievePayments } from "@/actions/payment";
import { postRefund } from "@/actions/refund";
import { putSubscription, retrieveSubscriptions as retrieveDBSubscriptions } from "@/actions/subscription";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
} from "@/integrations/soroban-contract";
import { isValidPublicKey, sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId, toCamelCase } from "@/lib/utils";
import { CreateRefund, Result, z as Schema, CreateRefundSchema_2026_08_18 } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: { body: CreateRefundSchema_2026_08_18.extend({ wallet_address: Schema.string().optional() }) },
  mcp: { name: "create_refund", description: "Create a refund" },
  handler: async ({ body: rawBody, auth: { organizationId, environment } }) => {
    const {
      paymentId,
      reason,
      metadata,
      walletAddress: wallet_address,
    } = toCamelCase<CreateRefund & { wallet_address?: string }>(rawBody);

    const [
      {
        data: [payment],
      },
      { secret },
    ] = await Promise.all([
      retrievePayments(organizationId, environment, { paymentId }, { withWallets: true }),
      retrieveOrganizationIdAndSecret(organizationId, environment),
    ]);

    if (!secret?.encrypted)
      throw new AppError(
        "VALIDATION_ERROR",
        "Refunds require a stored secret key. Contact us at support@stellartools.dev to enable refunds."
      );

    const refundToWalletAddress = wallet_address ?? payment?.wallets?.address;

    const {
      data: [platformCharge],
    } = await retrieveCharges(organizationId, environment, { paymentId, type: "platform_fee" }, { limit: 1 });

    const feeCrypto = platformCharge ? Number(platformCharge.cryptoAmount) : 0;
    const feeAmountCents = platformCharge ? platformCharge.amountCents : 0;

    const refundCryptoAmount = (Number(payment.cryptoAmount) - feeCrypto).toFixed(7);
    const refundAmountCents = payment.amountCents - feeAmountCents;

    const refundId = generateResourceId("rf", paymentId, 15);
    const secretKey = decrypt(secret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? "");

    const isValidPublicKeyResult = isValidPublicKey(refundToWalletAddress);

    if (isValidPublicKeyResult.isErr()) throw new AppError("INTERNAL_ERROR", isValidPublicKeyResult.error.message);

    const res = await sendAssetPayment(
      secretKey,
      refundToWalletAddress!,
      payment.selectedAssetCode,
      payment.selectedAssetIssuer!,
      refundCryptoAmount,
      environment,
      refundId
    );

    const refund = await postRefund(
      {
        id: refundId,
        paymentId,
        reason,
        status: res.isOk() ? "succeeded" : "failed",
        receiverWalletAddress: refundToWalletAddress!,
        customerId: payment.customerId,
        cryptoAmount: refundCryptoAmount,
        selectedAssetCode: payment.selectedAssetCode,
        selectedAssetIssuer: payment.selectedAssetIssuer,
        transactionHash: res.isOk() ? res.value?.hash : null,
        amountCents: refundAmountCents,
        currencyCode: payment.currencyCode,
        metadata: metadata,
      },
      organizationId,
      environment,
      { errorMessage: res.isErr() ? res.error.message : undefined }
    );

    const runSidedEffects = async () => {
      if (payment.subscriptionId && payment.customerId) {
        const {
          data: [subscription],
        } = await retrieveDBSubscriptions(
          organizationId,
          environment,
          { subscriptionId: payment.subscriptionId },
          { withCustomer: true, withProduct: true }
        );

        if (!subscription) throw new AppError("NOT_FOUND", "Subscription not found");

        const merchantSecret = await resolveMerchantSecret(organizationId, environment, "cancel subscriptions");

        const cancellationResult = await soroban$cancelSubscription(
          environment,
          merchantSecret,
          payment.wallets!.address,
          subscription.productId!
        );

        if (cancellationResult.isErr()) throw new AppError("INTERNAL_ERROR", cancellationResult.error.message);

        await putSubscription(
          payment.subscriptionId,
          {
            status: "canceled",
            canceledAt: new Date(),
            metadata: { ...(subscription.metadata ?? {}), cancelReason: "refund" },
          },
          organizationId,
          environment
        );
      }
    };

    waitUntil(runSidedEffects());

    return Result.ok({
      id: refund.id,
      payment_id: refund.paymentId,
      customer_id: refund.customerId,
      amount: `${refund.cryptoAmount} ${refund.selectedAssetCode}`,
      status: refund.status,
      reason: refund.reason ?? null,
      receiver_wallet_address: refund.receiverWalletAddress,
      metadata: refund.metadata ?? {},
      created_at: refund.createdAt,
    });
  },
});
