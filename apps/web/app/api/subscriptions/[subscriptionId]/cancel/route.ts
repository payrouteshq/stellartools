import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
} from "@/integrations/soroban-contract";
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

    const merchantSecret = await resolveMerchantSecret(organizationId, environment);
    const cancellationResult = await soroban$cancelSubscription(
      environment,
      merchantSecret,
      customerWallet.address,
      subscription.productId
    );

    if (cancellationResult.isErr()) return Result.err(cancellationResult.error);

    return await putSubscription(
      subscriptionId,
      { status: "canceled", canceledAt: new Date() },
      organizationId,
      environment
    ).then((_) => Result.ok({ success: true }));
  },
});
