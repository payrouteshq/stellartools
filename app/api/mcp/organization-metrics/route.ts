import { retrieveOverviewStats } from "@/actions/organization";
import { apiHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

/**
 * MCP / automation — high-level merchant snapshot for the authenticated org (same auth as REST API).
 * Returns compact numbers only (no charts) to stay within typical MCP payloads.
 */
export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  schema: {},
  handler: async ({ auth: { organizationId, environment } }) => {
    const stats = await retrieveOverviewStats({ orgId: organizationId, env: environment });

    return Result.ok({
      organizationId,
      environment,
      periodDays: 28,
      totalCustomers: stats.totalCustomers,
      activeSubscriptions: stats.activeSubscriptions,
      activeTrials: stats.activeTrials,
      newCustomersInPeriod: stats.newCustomers,
      mrrUsdCents: stats.mrr,
      netRevenueLast28DaysUsdCents: stats.revenue,
    });
  },
});
