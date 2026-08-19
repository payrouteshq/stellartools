import { getAnchorConfig, supportedFiatCurrencySchema } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { Sep38Client } from "@/integrations/anchor/sep38";
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
    const destinationCurrencies = toml.ANCHOR_QUOTE_SERVER
      ? await new Sep38Client(config, toml, "")
          .getInfo()
          .then((quoteInfo) =>
            quoteInfo.assets.flatMap((asset) => {
              if (!asset.asset.startsWith("iso4217:")) return [];
              const currency = asset.asset.slice("iso4217:".length);
              const parsedCurrency = supportedFiatCurrencySchema.safeParse(currency);
              return parsedCurrency.success ? [parsedCurrency.data] : [];
            })
          )
          .catch((error) => {
            if (!config.destinationCurrenciesFallback) throw error;
            console.warn(
              "[OFFRAMP_QUOTE_CAPABILITIES_FALLBACK]",
              error instanceof Error ? error.message : "Unknown error"
            );
            return [...config.destinationCurrenciesFallback];
          })
      : (["NGN", "USD", "GBP", "EUR"] as const);

    return Result.ok({
      provider: { id: config.id, name: config.displayName },
      environment,
      sandbox: config.id === "sdf-test-anchor",
      assets,
      destinationCurrencies,
      payoutRails: ["bank_account", "mobile_money", "paypal", "cash_pickup", "card_transfer"] as const,
    });
  },
});
