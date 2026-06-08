import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { CURRENCY_CODES } from "@stellartools/core";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey"],
  mcp: { name: "retrieve_supported_currencies", description: "Retrieve supported currencies" },
  handler: async () => {
    return Result.ok(CURRENCY_CODES);
  },
});
