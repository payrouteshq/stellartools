import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { getUsdcIssuers } from "@/lib/usdc";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey"],
  mcp: { name: "retrieve_supported_assets", description: "Retrieve supported assets" },
  handler: async ({ auth: { environment } }) => {
    return Result.ok(
      getUsdcIssuers(environment).map((canonicalIssuer, index) => ({
        code: "USDC",
        description: index === 0 ? "USD Coin (primary settlement asset)" : "USD Coin (accepted issuer)",
        canonicalIssuer,
        images: [],
      }))
    );
  },
});
