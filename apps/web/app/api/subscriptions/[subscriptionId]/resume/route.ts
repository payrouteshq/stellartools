import { retrievePaymentCount } from "@/actions/payment";
import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import {
  resolveMerchantSecret,
  resumeSubscription as soroban$resumeSubscription,
} from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "portal"],
  schema: { params: Schema.object({ subscriptionId: Schema.string() }) },
  handler: async ({ params: { subscriptionId }, auth: { organizationId, environment } }) => {
    const [
      {
        data: [subscription],
      },
      failedPaymentCount,
    ] = await Promise.all([
      retrieveSubscriptions(
        organizationId,
        environment,
        { subscriptionId },
        { withCustomer: true, withProduct: true, withCustomerWallets: true }
      ),
      retrievePaymentCount(organizationId, environment, {
        subscriptionIds: [subscriptionId],
        status: "failed",
      }),
    ]);

    const customerWallet = subscription?.customerWallet;

    if (!customerWallet?.address) throw new AppError("NOT_FOUND", "Customer wallet not found");

    const merchantSecret = await resolveMerchantSecret(organizationId, environment);

    const resumeResult = await soroban$resumeSubscription(
      environment,
      merchantSecret,
      customerWallet.address,
      subscription.productId
    );

    if (resumeResult.isErr()) {
      return Result.err(new AppError("INTERNAL_ERROR", "Failed to resume subscription: " + resumeResult.error.message));
    }

    const result = await putSubscription(
      subscriptionId,
      { status: "active", pausedAt: null },
      organizationId,
      environment
    );

    return Result.ok({
      id: result.id,
      customerId: result.customerId,
      productId: result.productId,
      status: result.status,
      currentPeriodStart: result.currentPeriodStart,
      currentPeriodEnd: result.currentPeriodEnd,
      cancelAtPeriodEnd: result.cancelAtPeriodEnd,
      canceledAt: result.canceledAt ?? null,
      pausedAt: result.pausedAt ?? null,
      failedPaymentCount,
      createdAt: result.createdAt ?? null,
      updatedAt: result.updatedAt,
      metadata: result.metadata ?? null,
      trialDays: result.trialDays ?? null,
    });
  },
});
