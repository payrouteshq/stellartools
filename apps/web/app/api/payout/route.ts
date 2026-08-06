import { retrieveSupportedAssets } from "@/actions/asset";
import { retrieveOrganization, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayout, putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { getAssetUsdPrice, getFiatRates } from "@/integrations/price-feed";
import { isValidPublicKey, sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Money } from "@/lib/money";
import { generateResourceId } from "@/lib/utils";
import { Result, z as Schema } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session"],
  schema: {
    body: Schema.object({
      walletAddress: Schema.string(),
      assetCode: Schema.string(),
      assetIssuer: Schema.string().nullable().optional(),
      cryptoAmount: Schema.string(),
      memo: Schema.string().max(28).nullable().optional(),
    }),
  },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    const { walletAddress, assetCode, assetIssuer, cryptoAmount, memo } = body;

    const keyCheck = isValidPublicKey(walletAddress);
    if (keyCheck.isErr()) throw new AppError("INTERNAL_ERROR", keyCheck.error.message);

    const [{ secret, walletStrategy }, org] = await Promise.all([
      retrieveOrganizationIdAndSecret(organizationId, environment),
      retrieveOrganization(organizationId),
    ]);

    if (!secret) {
      throw new AppError("VALIDATION_ERROR", "Payouts require a stored secret key. Add your secret key in organization settings to enable payouts.");
    }

    const [assetList, fiatRates] = await Promise.all([
      retrieveSupportedAssets({ code: assetCode }, environment),
      getFiatRates(),
    ]);

    const assetMeta = assetList?.[0] ?? null;
    const usdPrice = assetMeta?.metadata ? await getAssetUsdPrice(assetMeta.metadata) : 0;
    const usdCents = Math.round(Number(cryptoAmount) * usdPrice * 100);
    const amountCents = Money.convert(usdCents, "USD", org.selectedCurrency, fiatRates);

    const secretKey = decrypt(secret.encrypted.replace(SENSITIVE_KEY_PREFIX, ""));
    const payoutId = generateResourceId("po", organizationId, 15);

    const payout = await postPayout(
      {
        id: payoutId,
        amountCents,
        currencyCode: org.selectedCurrency,
        cryptoAmount,
        selectedAssetCode: assetCode as any,
        selectedAssetIssuer: assetIssuer ?? null,
        status: "pending",
        walletAddress,
        memo: memo ?? null,
        transactionHash: null,
        completedAt: null,
        bankAccount: null,
        metadata: null,
      },
      organizationId,
      environment
    );

    waitUntil(
      (async () => {
        const res = await sendAssetPayment(
          secretKey,
          walletAddress,
          assetCode,
          assetIssuer ?? "",
          cryptoAmount,
          environment,
          memo ?? undefined
        );

        if (res.isErr()) {
          await putPayout(payoutId, { status: "failed" });
        } else {
          await putPayout(payoutId, {
            status: "succeeded",
            transactionHash: res.value!.hash,
            completedAt: new Date(),
          });
        }
      })()
    );

    return Result.ok({
      id: payout.id,
      status: "pending",
      wallet_address: walletAddress,
      crypto_amount: cryptoAmount,
      asset_code: assetCode,
      created_at: payout.createdAt,
    });
  },
});
