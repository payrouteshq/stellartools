import { retrieveCreditBalances } from "@/actions/credit";
import { deriveMeteringKeypair } from "@/integrations/mppx-server";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["apikey"],
  schema: {
    query: Schema.object({
      customerId: Schema.string(),
      productId: Schema.string(),
    }),
  },
  handler: async ({ query, auth }) => {
    const {
      data: [balance],
    } = await retrieveCreditBalances(auth.organizationId, auth.environment, {
      customerId: query.customerId,
      productId: query.productId,
    });

    if (!balance || !balance.channelAddress) {
      return Result.err(new Error("No active metered session found for this product."));
    }

    // Rematerialize the private key for the SDK
    const meteringKp = deriveMeteringKeypair(balance.id);

    return Result.ok({
      channel: balance.channelAddress,
      // The "Authorized Pen"
      meteringSecret: meteringKp.secret(),
      currentCumulative: balance.latestCumulativeAmount?.toString() ?? "0",
    });
  },
});
