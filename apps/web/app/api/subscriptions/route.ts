import { retrieveSubscriptions } from "@/actions/subscription";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:subscriptions",
  mcp: { name: "get_subscriptions", description: "Get subscriptions" },
  schema: { query: Schema.object({ customerId: Schema.string() }) },
  handler: async ({ query: { customerId }, auth: { organizationId, environment } }) => {
    const subscriptions = await retrieveSubscriptions(organizationId, environment, { customerId });
    return Result.ok(subscriptions);
  },
});
