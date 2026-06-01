import { retrieveCustomerWallets } from "@/actions/customers";
import { putSubscription, retrieveSubscription } from "@/actions/subscription";
import { pauseSubscription as pauseSorobanSubscription } from "@/integrations/soroban-contract";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "app", "portal"],
  requiredAppScope: "write:subscriptions",
  schema: { params: Schema.object({ id: Schema.string() }) },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    const {
      data: [subscription],
    } = await retrieveSubscription(id, organizationId, environment, { limit: 1 });

    const [customerWallet] = await retrieveCustomerWallets(subscription.customerId, {
      id: subscription.customerWalletId,
    });

    if (!customerWallet?.address) throw new AppError("Customer wallet not found");

    const pauseResult = await pauseSorobanSubscription(
      environment,
      customerWallet.address,
      subscription.customerId,
      subscription.productId
    );

    if (pauseResult.isErr()) return Result.err(pauseResult.error);

    const result = await putSubscription(id, { status: "paused", pausedAt: new Date() }, organizationId, environment);

    return Result.ok({ ...result });
  },
});
