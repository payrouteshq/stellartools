import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

import { resolvePublicPayments } from "./shared";

const querySchema = Schema.object({
  customer: Schema.string().optional(),
  limit: Schema.coerce.number().default(10),
  starting_after: Schema.string().optional(),
});

export const GET = apiHandler({
  auth: ["apikey", "app"],
  requiredAppScope: "read:payments",
  mcp: { name: "get_payments", description: "Get payments" },
  schema: { query: querySchema },
  handler: async ({ query, auth }) => {
    const results = await resolvePublicPayments(auth.organizationId, auth.environment, {
      customerId: query.customer,
      ...query,
    });

    return Result.ok(results);
  },
});
