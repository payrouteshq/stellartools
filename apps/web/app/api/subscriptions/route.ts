import { retrieveSubscriptions } from "@/actions/subscription";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:subscriptions",
  mcp: { name: "get_subscriptions", description: "Get subscriptions" },
  schema: { query: Schema.object({ customer_id: Schema.string() }) },
  handler: async ({ query: { customer_id }, auth: { organizationId, environment } }) => {
    const subscriptions = await retrieveSubscriptions(organizationId, environment, { customerId: customer_id });
    return Result.ok(
      subscriptions.data.map((s) => ({
        id: s.id,
        customerId: s.customerId,
        productId: s.productId,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        canceledAt: s.canceledAt ?? null,
        pausedAt: s.pausedAt ?? null,
        failedPaymentCount: null,
        createdAt: s.createdAt ?? null,
        updatedAt: s.updatedAt,
        metadata: s.metadata ?? null,
        trialDays: s.trialDays ?? null,
      }))
    );
  },
});
