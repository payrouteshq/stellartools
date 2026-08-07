import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayout, putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { getAnchorConfig, supportedFiatCurrencySchema } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { getStellarConfig, retrieveAccount } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId } from "@/lib/utils";
import Big from "big.js";
import { Result } from "@stellartools/core";
import { z } from "zod";

const createOfframpSchema = z.object({
  providerId: z.literal("sdf-test-anchor"),
  assetCode: z.string().min(1),
  assetIssuer: z.string().nullable(),
  cryptoAmount: z.string().regex(/^\d+(?:\.\d{1,7})?$/),
  destinationCurrency: supportedFiatCurrencySchema,
  destinationCountry: z.string().length(2).transform((value) => value.toUpperCase()),
  payoutRail: z.literal("bank_account"),
});

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  schema: { body: createOfframpSchema },
  handler: async ({ body, auth: { organizationId, environment } }) => {
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
      const spendable = new Big(balance.balance).minus(baseReserve.times(reserveEntries)).minus("0.00001");
      if (requestedAmount.gt(spendable)) {
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
        throw new AppError("VALIDATION_ERROR", `Minimum payout amount is ${assetInfo.min_amount} ${configuredAsset.code}`);
      }
      if (assetInfo.max_amount && requestedAmount.gt(new Big(assetInfo.max_amount))) {
        throw new AppError("VALIDATION_ERROR", `Maximum payout amount is ${assetInfo.max_amount} ${configuredAsset.code}`);
      }

      const interactive = await sep24.initiateWithdrawal({
        assetCode: configuredAsset.sep24Code ?? configuredAsset.code,
        assetIssuer: configuredAsset.issuer ?? undefined,
        amount: body.cryptoAmount,
        account: secret.publicKey,
      });
      await putPayout(payoutId, {
        providerTransactionId: interactive.id,
        providerStatus: "incomplete",
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
