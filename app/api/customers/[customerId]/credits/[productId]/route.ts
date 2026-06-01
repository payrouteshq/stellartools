import { retrieveCreditBalance } from "@/actions/credit";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: Schema.object({ customer_id: Schema.string(), product_id: Schema.string() }) },
  handler: async ({ params, auth }) => {
    const balance = await retrieveCreditBalance(params.customer_id, params.product_id, auth.organizationId);
    if (balance?.isRevoked) throw new AppError("Credit balance has been revoked");
    return Result.ok(balance);
  },
});
