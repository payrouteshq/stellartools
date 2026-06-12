import { getFiatRates } from "@/integrations/price-feed";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  handler: async () => {
    const fiatRates = await getFiatRates();
    return Result.ok({ fiatRates });
  },
  headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
});
