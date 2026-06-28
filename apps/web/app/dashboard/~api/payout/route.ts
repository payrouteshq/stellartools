import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayout, putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { decrypt } from "@/integrations/encryption";
import { sendAssetPayment } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId } from "@/lib/utils";
import { Result, z as Schema, currencyCodeSchema } from "@stellartools/core";
import { all } from "better-all";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session"],
  schema: {
    body: Schema.object({
      amount: Schema.number(),
      walletAddress: Schema.string().nullable(),
      bankAccount: Schema.record(Schema.string(), Schema.any()).nullable(),
      memo: Schema.string().optional(),
      txHash: Schema.string().nullable(),
      currencyCode: currencyCodeSchema,
      assetCode: Schema.string(),
      assetIssuer: Schema.string(),
    }),
  },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    const { secret } = await all({
      secret: async () => {
        const { secret: s } = await retrieveOrganizationIdAndSecret(organizationId, environment);
        if (!s) throw new AppError("Merchant keys not configured, please contact support");
        return s;
      },
    });

    const secretKey = decrypt(secret.encrypted?.replace(SENSITIVE_KEY_PREFIX, "") ?? "");

    const payoutId = generateResourceId("pay", organizationId, 20);

    if (!body.walletAddress) {
      throw new AppError("Wallet address is required");
    }

    const sendPayoutResult = await sendAssetPayment(
      secretKey,
      body.walletAddress,
      body.assetCode,
      body.assetIssuer,
      body.amount.toString(),
      environment,
      body.memo
    );

    if (sendPayoutResult.isErr()) {
      await putPayout(payoutId, { status: "failed", completedAt: new Date() });
      return Result.err(sendPayoutResult.error);
    }

    await putPayout(payoutId, {
      status: "succeeded",
      transactionHash: sendPayoutResult.value?.hash,
      completedAt: new Date(),
    });

    const payout = await postPayout(
      {
        id: payoutId,
        status: "pending",
        amountCents: body.amount,
        currencyCode: body.currencyCode,
        cryptoAmount: body.amount.toString(),
        walletAddress: body.walletAddress,
        memo: body.memo ?? null,
        metadata: null,
        transactionHash: body.txHash,
        completedAt: null,
        selectedAssetCode: body.assetCode,
        selectedAssetIssuer: body.assetIssuer,
        bankAccount: body.bankAccount,
      },
      organizationId,
      environment
    );

    return Result.ok(payout);
  },
});
