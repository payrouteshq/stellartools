import { reconcilePendingFiatPayouts } from "@/actions/offramp";
import { apiHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["vercelToken"],
  handler: async () => {
    const results = await reconcilePendingFiatPayouts();
    return Result.ok({
      processed: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      timestamp: new Date().toISOString(),
      errors: results.filter((result) => !result.ok),
    });
  },
});

