import { retrieveCustomerWallets } from "@/actions/customers";
import { putSubscription, retrieveSubscription } from "@/actions/subscription";
import { cancelSubscription as cancelSorobanSubscription } from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";
import { all } from "better-all";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "portal"],
  schema: { params: Schema.object({ id: Schema.string() }) },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    const { subscription, customerWallet } = await all({
      subscription: async () => {
        const {
          data: [subscription],
        } = await retrieveSubscription(id, organizationId, environment, { limit: 1 });
        return subscription;
      },

      async customerWallet() {
        const subscription = await this.$.subscription;
        return await retrieveCustomerWallets(
          subscription.customerId,
          { id: subscription.customerWalletId },
          organizationId,
          environment
        ).then(([w]) => w ?? null);
      },
    });

    if (!customerWallet?.address) throw new AppError("Customer wallet not found");

    const cancellationResult = await cancelSorobanSubscription(
      environment,
      customerWallet.address,
      subscription.customerId,
      subscription.productId
    );

    if (cancellationResult.isErr()) return Result.err(cancellationResult.error);

    return await putSubscription(id, { canceledAt: new Date() }, organizationId, environment).then((_) =>
      Result.ok({ success: true })
    );
  },
});
