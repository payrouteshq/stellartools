import { retrieveCreditBalances } from "@/actions/credit";
import { getLeanBalanceInfo } from "@/integrations/mppx-server";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey"],
  schema: {
    params: Schema.object({
      customerId: Schema.string(),
      productId: Schema.string(),
    }),
  },
  handler: async ({ params, auth }) => {
    const {
      data: [balance],
    } = await retrieveCreditBalances(auth.organizationId, auth.environment, {
      customerId: params.customerId,
      productId: params.productId,
    });

    if (!balance || !balance.channelAddress) return Result.err(new Error("No active channel"));

    const leanBalanceInfo = await getLeanBalanceInfo({
      channelAddress: balance.channelAddress!,
      network: balance.environment,
      unsettledAmount: Number(balance.latestCumulativeAmount ?? 0),
    });

    return Result.ok(leanBalanceInfo);
  },
});
