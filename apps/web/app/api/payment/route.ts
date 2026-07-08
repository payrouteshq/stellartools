import { apiHandler } from "@/lib/api-handler";
import { apiListParamsSchema } from "@/types";
import { Result, z as Schema } from "@stellartools/core";

import { resolvePublicPayments } from "./shared";

export const GET = apiHandler({
  auth: ["apikey", "app"],
  requiredAppScope: "read:payments",
  mcp: { name: "get_payments", description: "Get payments" },
  schema: { query: apiListParamsSchema.extend({ customer: Schema.string().optional() }) },
  handler: async ({ query, auth }) => {
    const { customer, limit, starting_after, ending_before } = query;
    const results = await resolvePublicPayments(auth.organizationId, auth.environment, {
      customerId: customer,
      limit,
      starting_after,
      ending_before,
    });

    return Result.ok(results);
  },
});
