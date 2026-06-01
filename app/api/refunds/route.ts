import { putCreditBalance } from "@/actions/credit";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrievePayments } from "@/actions/payment";
import { postRefund } from "@/actions/refund";
import { putSubscription, retrieveSubscription as retrieveDBSubscription } from "@/actions/subscription";
import { decrypt } from "@/integrations/encryption";
import { cancelSubscription as cancelSorobanSubscription, retrieveSubscription } from "@/integrations/soroban-contract";
import { isValidPublicKey, sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId, toCamelCase, xlmToStroops } from "@/lib/utils";
import { Result, z as Schema, createRefundSchema } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";
import { all } from "better-all";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:refunds",
  schema: { body: createRefundSchema.extend({ wallet_address: Schema.string().optional() }) },
  mcp: { name: "create_refund", description: "Create a refund" },
  handler: async ({ body: rawBody, auth: { organizationId, environment } }) => {
    const { paymentId: payment_id, reason, metadata, walletAddress: wallet_address } = toCamelCase<any>(rawBody);
    const { payment, secret } = await all({
      payment: async () => {
        const {
          data: [p],
        } = await retrievePayments(
          organizationId,
          environment,
          { paymentId: payment_id },
          { withWallets: true, withAsset: true }
        );
        if (!p) throw new AppError("Payment not found");
        if (!p.asset) throw new AppError("Payment asset not found");
        if (!p.wallets?.address) throw new AppError("Customer wallet address not found");
        return p;
      },
      secret: async () => {
        const { secret: s } = await retrieveOrganizationIdAndSecret(organizationId, environment);
        if (!s) throw new AppError("Merchant keys not configured, please contact support");
        return s;
      },
    });

    const refundId = generateResourceId("rf", payment_id, 15);
    const secretKey = decrypt(secret.encrypted);

    const isValidPublicKeyResult = isValidPublicKey(wallet_address ?? payment?.wallets?.address);

    if (isValidPublicKeyResult.isErr()) throw new AppError(isValidPublicKeyResult.error.message);

    const res = await sendAssetPayment(
      secretKey,
      payment.wallets!.address,
      payment.asset!.code,
      payment.asset!.issuer!,
      String(payment.amount),
      environment,
      refundId
    );

    const refund = await postRefund(
      {
        id: refundId,
        paymentId: payment_id,
        reason,
        metadata,
        status: res.isOk() ? "succeeded" : "failed",
        receiverWalletAddress: wallet_address ?? payment.wallets!.address,
        customerId: payment.customerId,
        amount: xlmToStroops(payment.amount.toString()),
        assetCode: payment.asset!.code,
      },
      organizationId,
      environment,
      { errorMessage: res.isErr() ? res.error.message : undefined }
    );

    const runSidedEffects = async () => {
      if (payment.creditBalanceId) {
        await putCreditBalance(payment.creditBalanceId, { isRevoked: true });
      }

      if (payment.subscriptionId && payment.customerId) {
        const {
          data: [subscription],
        } = await retrieveDBSubscription(payment.subscriptionId, organizationId, environment, {
          limit: 1,
        });

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
