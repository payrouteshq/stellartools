import { getAnchorConfig } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  handler: async ({ auth: { environment } }) => {
    const config = getAnchorConfig(environment, process.env.ACTIVE_OFFRAMP_ANCHOR);
    const toml = await discoverAnchor(config);
    const info = await new Sep24Client(config, toml, "").getInfo().catch((error) => {
      if (!config.capabilitiesFallback) throw error;
      console.warn("[OFFRAMP_CAPABILITIES_FALLBACK]", error instanceof Error ? error.message : "Unknown error");
      return { withdraw: config.capabilitiesFallback };
    });

    const assets = config.withdrawAssets
      .filter((asset) => info.withdraw[asset.sep24Code ?? asset.code]?.enabled)
      .map((asset) => ({
        code: asset.code,
        issuer: asset.issuer,
        minAmount: info.withdraw[asset.sep24Code ?? asset.code]?.min_amount ?? null,
        maxAmount: info.withdraw[asset.sep24Code ?? asset.code]?.max_amount ?? null,
      }));

    return Result.ok({
      provider: { id: config.id, name: config.displayName },
      environment,
      sandbox: config.id === "sdf-test-anchor",
      assets,
      destinationCurrencies: ["NGN", "USD", "GBP", "EUR"] as const,
      payoutRails: ["bank_account"] as const,
    });
  },
});
