import { retrieveCreditTransaction } from "@/actions/credit";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey", "session"],
  schema: {
    params: Schema.object({ customerId: Schema.string(), transactionId: Schema.string() }),
  },
  handler: async ({ params, auth }) => {
    const transaction = await retrieveCreditTransaction(params.transactionId, auth.organizationId);
    return Result.ok(transaction);
  },
});
