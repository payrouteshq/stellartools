import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import { pauseSubscription as pauseSorobanSubscription } from "@/integrations/soroban-contract";
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

    const customerWallet = subscription?.customerWallet;

    if (!customerWallet?.address) throw new AppError("Customer wallet not found");

    const pauseResult = await pauseSorobanSubscription(
      environment,
      customerWallet.address,
      subscription.customerId,
      subscription.productId
    );

    if (pauseResult.isErr()) return Result.err(pauseResult.error);

    const result = await putSubscription(
      subscriptionId,
      { status: "paused", pausedAt: new Date() },
      organizationId,
      environment
    );

    return Result.ok({ ...result });
  },
});
