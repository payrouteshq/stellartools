import { retrieveSubscriptions } from "@/actions/subscription";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { apiListParamsSchema } from "@/types";
import { Result, z as Schema } from "@stellartools/core";
import { and, eq, inArray, sql } from "drizzle-orm";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:subscriptions",
  mcp: { name: "get_subscriptions", description: "Get subscriptions" },
  schema: { query: apiListParamsSchema.extend({ customer_id: Schema.string() }) },
  handler: async ({
    query: { customer_id, limit, starting_after, ending_before },
    auth: { organizationId, environment },
  }) => {
    const subscriptions = await retrieveSubscriptions(organizationId, environment, {
      customerId: customer_id,
      limit,
      starting_after,
      ending_before,
    });

    const subscriptionIds = subscriptions.data.map((s) => s.id);

    let failedCounts: { id: string | null; count: number }[] = [];

    if (subscriptionIds.length > 0) {
      failedCounts = await db
        .select({
          id: payments.subscriptionId,
          count: sql<number>`count(*)::int`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.status, "failed"),
            inArray(payments.subscriptionId, subscriptionIds)
          )
        )
        .groupBy(payments.subscriptionId);
    }

    const countMap = Object.fromEntries(failedCounts.map((c) => [c.id, c.count]));

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
        failedPaymentCount: countMap[s.id] ?? 0,
        createdAt: s.createdAt ?? null,
        updatedAt: s.updatedAt,
        metadata: s.metadata ?? null,
        trialDays: s.trialDays ?? null,
      }))
    );
  },
});
