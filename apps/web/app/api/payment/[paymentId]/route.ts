import { AppError } from "@/lib/action-handler";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

import { resolvePublicPayments } from "../shared";

export const GET = apiHandler({
  auth: ["apikey", "app"],
  requiredAppScope: "read:payments",
  mcp: { name: "get_payment", description: "Get a payment" },
  schema: { params: Schema.object({ paymentId: Schema.string() }) },
  handler: async ({ params: { paymentId }, auth }) => {
    const { data } = await resolvePublicPayments(auth.organizationId, auth.environment, {
      paymentId,
      limit: 1,
    });

    if (data.length === 0) throw new AppError("Payment not found");

    return Result.ok(data[0]);
  },
});
