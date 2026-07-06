import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "portal"],
  schema: { params: Schema.object({ subscriptionId: Schema.string() }) },
  handler: async ({ params: { subscriptionId }, auth: { organizationId, environment } }) => {
    const {
      data: [subscription],
    } = await retrieveSubscriptions(
      organizationId,
      environment,
      { subscriptionId },
      { withCustomer: true, withProduct: true, withCustomerWallets: true }
    );

    if (!subscription) throw new AppError("Subscription not found");
    if (subscription.status === "canceled") throw new AppError("Subscription is already canceled");
    if (subscription.cancelAtPeriodEnd) throw new AppError("Subscription is already scheduled to cancel");

    const result = await putSubscription(
      subscriptionId,
      { cancelAtPeriodEnd: true },
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
      failedPaymentCount: null,
      createdAt: result.createdAt ?? null,
      updatedAt: result.updatedAt,
      metadata: result.metadata ?? null,
      trialDays: result.trialDays ?? null,
    });
  },
});
