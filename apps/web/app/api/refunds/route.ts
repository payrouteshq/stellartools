import { putCreditBalance } from "@/actions/credit";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrievePayments } from "@/actions/payment";
import { postRefund } from "@/actions/refund";
import { putSubscription, retrieveSubscriptions as retrieveDBSubscriptions } from "@/actions/subscription";
import { decrypt } from "@/integrations/encryption";
import { cancelSubscription as cancelSorobanSubscription } from "@/integrations/soroban-contract";
import { isValidPublicKey, sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId, toCamelCase } from "@/lib/utils";
import { Result, z as Schema, createRefundSchema } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: { body: createRefundSchema.extend({ wallet_address: Schema.string().optional() }) },
  mcp: { name: "create_refund", description: "Create a refund" },
  handler: async ({ body: rawBody, auth: { organizationId, environment } }) => {
    const { paymentId: payment_id, reason, metadata, walletAddress: wallet_address } = toCamelCase<any>(rawBody);

    const [
      {
        data: [payment],
      },
      { secret },
    ] = await Promise.all([
      retrievePayments(
        organizationId,
        environment,
        { paymentId: payment_id },
        { withWallets: true, withCreditBalance: true }
      ),
      retrieveOrganizationIdAndSecret(organizationId, environment),
    ]);

    if (!secret) throw new AppError("Merchant keys not configured, please contact support");

    const refundId = generateResourceId("rf", payment_id, 15);
    const secretKey = decrypt(secret.encrypted);

    const isValidPublicKeyResult = isValidPublicKey(wallet_address ?? payment?.wallets?.address);

    if (isValidPublicKeyResult.isErr()) throw new AppError(isValidPublicKeyResult.error.message);

    const res = await sendAssetPayment(
      secretKey,
      payment.wallets!.address,
      payment.selectedAssetCode,
      payment.selectedAssetIssuer!,
      String(payment.cryptoAmount),
      environment,
      refundId
    );

    const refund = await postRefund(
      {
        id: refundId,
        paymentId: payment_id,
        reason,
        status: res.isOk() ? "succeeded" : "failed",
        receiverWalletAddress: wallet_address ?? payment.wallets!.address,
        customerId: payment.customerId,
        cryptoAmount: payment.cryptoAmount,
        selectedAssetCode: payment.selectedAssetCode,
        selectedAssetIssuer: payment.selectedAssetIssuer,
        transactionHash: res.isOk() ? res.value?.hash : null,
        amountCents: payment.amountCents,
        currencyCode: payment.currencyCode,
        metadata: metadata,
      },
      organizationId,
      environment,
      { errorMessage: res.isErr() ? res.error.message : undefined }
    );

    const runSidedEffects = async () => {
      if (payment.creditBalance?.id) {
        await putCreditBalance(payment.creditBalance.id, { settledAt: new Date() }, organizationId, environment);
      }

      if (payment.subscriptionId && payment.customerId) {
        const {
          data: [subscription],
        } = await retrieveDBSubscriptions(
          organizationId,
          environment,
          { subscriptionId: payment.subscriptionId },
          { withCustomer: true, withProduct: true }
        );

        if (!subscription) throw new AppError("Subscription not found");

        const cancellationResult = await cancelSorobanSubscription(
          environment,
          payment.wallets!.address,
          subscription.customerId!,
          subscription.productId!
        );

        if (cancellationResult.isErr()) throw new AppError(cancellationResult.error.message);

        await putSubscription(
          payment.subscriptionId,
          {
            canceledAt: new Date(),
            metadata: { ...(subscription.metadata ?? {}), cancelReason: "refund" },
          },
          organizationId,
          environment
        );
      }
    };

    waitUntil(runSidedEffects());

    return Result.ok(refund);
  },
});
