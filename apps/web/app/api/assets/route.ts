import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { getUsdcAsset } from "@/lib/usdc";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey"],
  mcp: { name: "retrieve_supported_assets", description: "Retrieve supported assets" },
  handler: async ({ auth: { environment } }) => {
    const usdc = getUsdcAsset(environment);
    return Result.ok([
      {
        code: usdc.code,
        description: "USD Coin",
        canonicalIssuer: usdc.canonicalIssuer,
        images: [],
      },
    ]);
  },
});
