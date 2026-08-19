import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayout, putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { getAnchorConfig, supportedFiatCurrencySchema, supportedPayoutRailSchema } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client, isExpiredQuoteError } from "@/integrations/anchor/sep24";
import { Sep38Client } from "@/integrations/anchor/sep38";
import { decrypt } from "@/integrations/encryption";
import { getStellarConfig, retrieveAccount } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId } from "@/lib/utils";
import { Result } from "@stellartools/core";
import Big from "big.js";
import { z } from "zod";

const createOfframpSchema = z.object({
  providerId: z.literal("sdf-test-anchor"),
  assetCode: z.string().min(1),
  assetIssuer: z.string().nullable(),
  cryptoAmount: z.string().regex(/^\d+(?:\.\d{1,7})?$/),
  destinationCurrency: supportedFiatCurrencySchema,
  destinationCountry: z
    .string()
    .length(2)
    .transform((value) => value.toUpperCase()),
  payoutRail: supportedPayoutRailSchema,
});

export const OPTIONS = createOptionsHandler();

function toSep38StellarAsset(code: string, issuer: string | null): string {
  return issuer ? `stellar:${code}:${issuer}` : "stellar:native";
}

export const POST = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  schema: { body: createOfframpSchema },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    if (environment === "mainnet") {
      throw new AppError("VALIDATION_ERROR", "Fiat offramp payouts are currently only available on Testnet");
    }

    const requestedAmount = new Big(body.cryptoAmount);
    if (requestedAmount.lte(0)) throw new AppError("VALIDATION_ERROR", "Payout amount must be greater than zero");

    const config = getAnchorConfig(environment, body.providerId);
    const configuredAsset = config.withdrawAssets.find(
      (asset) => asset.code === body.assetCode && asset.issuer === body.assetIssuer
    );
    if (!configuredAsset) throw new AppError("VALIDATION_ERROR", "Asset is not available for this offramp provider");

    const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);
    if (!secret) {
      throw new AppError("VALIDATION_ERROR", "Merchant Stellar wallet not configured. Set up your wallet in Settings.");
    }

    const accountResult = await retrieveAccount(secret.publicKey, environment);
    if (accountResult.isErr()) throw new AppError("INTERNAL_ERROR", "Unable to retrieve the organization wallet");
    const balance = accountResult.value.balances.find((entry) => {
      if (configuredAsset.issuer === null) return entry.asset_type === "native" && configuredAsset.code === "XLM";
      return (
        "asset_code" in entry &&
        "asset_issuer" in entry &&
        entry.asset_code === configuredAsset.code &&
        entry.asset_issuer === configuredAsset.issuer
      );
    });
    if (!balance || requestedAmount.gt(new Big(balance.balance))) {
      throw new AppError("VALIDATION_ERROR", "Payout amount exceeds the available wallet balance");
    }
    let spendableAmount = new Big(balance.balance);
    if (configuredAsset.issuer === null) {
      const { server } = getStellarConfig(environment);
      const { records } = await server.ledgers().order("desc").limit(1).call();
      const latestLedger = records[0];
      if (!latestLedger) throw new AppError("INTERNAL_ERROR", "Unable to calculate the Stellar account reserve");
      const baseReserve = new Big(latestLedger.base_reserve_in_stroops).div(10_000_000);
      const reserveEntries = new Big(2)
        .plus(accountResult.value.subentry_count)
        .plus(accountResult.value.num_sponsoring)
        .minus(accountResult.value.num_sponsored);
      spendableAmount = new Big(balance.balance).minus(baseReserve.times(reserveEntries)).minus("0.00001");
      if (requestedAmount.gt(spendableAmount)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Payout amount exceeds the spendable XLM balance after reserving ${baseReserve
            .times(reserveEntries)
            .toFixed(7)} XLM for account reserves`
        );
      }
    }

    const payoutId = generateResourceId("po", organizationId, 15);
    const payout = await postPayout(
      {
        id: payoutId,
        amountCents: 0,
        currencyCode: body.destinationCurrency,
        cryptoAmount: body.cryptoAmount,
        selectedAssetCode: configuredAsset.code,
        selectedAssetIssuer: configuredAsset.issuer,
        method: "fiat",
        status: "pending",
        walletAddress: null,
        memo: null,
        transactionHash: null,
        completedAt: null,
        bankAccount: null,
        metadata: { amountPendingProviderQuote: true },
        provider: config.id,
        providerTransactionId: null,
        providerStatus: "initiating",
        destinationCurrency: body.destinationCurrency,
        destinationCountry: body.destinationCountry,
        withdrawalMethod: body.payoutRail,
        providerUpdatedAt: new Date(),
      },
      organizationId,
      environment
    );

    try {
      const toml = await discoverAnchor(config);
      const secretKey = decrypt(secret.encrypted.replace(SENSITIVE_KEY_PREFIX, ""));
      const token = await authenticateWithSep10({ config, toml, accountSecret: secretKey });
      const sep24 = new Sep24Client(config, toml, token);
      const info = await sep24.getInfo();
      const assetInfo = info.withdraw[configuredAsset.sep24Code ?? configuredAsset.code];
      if (!assetInfo?.enabled) {
        throw new AppError("VALIDATION_ERROR", "Asset withdrawals are disabled by the provider");
      }
      if (assetInfo.min_amount && requestedAmount.lt(new Big(assetInfo.min_amount))) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Minimum payout amount is ${assetInfo.min_amount} ${configuredAsset.code}`
        );
      }
      if (assetInfo.max_amount && requestedAmount.gt(new Big(assetInfo.max_amount))) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Maximum payout amount is ${assetInfo.max_amount} ${configuredAsset.code}`
        );
      }

      const sellAsset = toSep38StellarAsset(configuredAsset.code, configuredAsset.issuer);
      const buyAsset = `iso4217:${body.destinationCurrency}`;
      const createQuote = toml.ANCHOR_QUOTE_SERVER
        ? () =>
            new Sep38Client(config, toml, token).createQuote({
              sellAsset,
              buyAsset,
              sellAmount: body.cryptoAmount,
            })
        : null;

      let quote = createQuote ? await createQuote() : null;
      const assertQuoteIsSpendable = () => {
        if (quote && new Big(quote.sell_amount).gt(spendableAmount)) {
          throw new AppError("VALIDATION_ERROR", "Quoted payout amount exceeds the available wallet balance");
        }
      };
      assertQuoteIsSpendable();
      const initiate = () =>
        sep24.initiateWithdrawal({
          assetCode: configuredAsset.sep24Code ?? configuredAsset.code,
          assetIssuer: configuredAsset.issuer ?? undefined,
          amount: quote?.sell_amount ?? body.cryptoAmount,
          account: secret.publicKey,
          quoteId: quote?.id,
          destinationAsset: quote?.buy_asset,
        });

      let interactive;
      try {
        interactive = await initiate();
      } catch (error) {
        if (!createQuote || !isExpiredQuoteError(error)) throw error;
        quote = await createQuote();
        assertQuoteIsSpendable();
        interactive = await initiate();
      }
      await putPayout(payoutId, {
        amountCents: quote ? new Big(quote.buy_amount).times(100).round(0, Big.roundHalfUp).toNumber() : 0,
        cryptoAmount: quote?.sell_amount ?? body.cryptoAmount,
        providerTransactionId: interactive.id,
        providerStatus: "incomplete",
        quoteId: quote?.id ?? null,
        quoteExpiresAt: quote ? new Date(quote.expires_at) : null,
        metadata: quote
          ? {
              amountPendingProviderQuote: false,
              quotedBuyAsset: quote.buy_asset,
              quotedBuyAmount: quote.buy_amount,
              quoteFee: quote.fee,
            }
          : { amountPendingProviderQuote: true },
        providerUpdatedAt: new Date(),
      });

      return Result.ok({
        id: payout.id,
        status: payout.status,
        providerTransactionId: interactive.id,
        interactiveUrl: interactive.url,
        sandbox: config.id === "sdf-test-anchor",
      });
    } catch (error: unknown) {
      console.error("[OFFRAMP_INITIATION_FAILURE]", error instanceof Error ? error.message : "Unknown provider error");
      await putPayout(payoutId, {
        status: "failed",
        providerStatus: "error",
        failureCode: "provider_initiation_failed",
        failureMessage: "The payout provider could not start the withdrawal",
        providerUpdatedAt: new Date(),
      });
      if (error instanceof AppError) throw error;
      throw new AppError("INTERNAL_ERROR", "The payout provider could not start the withdrawal");
    }
  },
});
