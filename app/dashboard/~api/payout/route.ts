import { retrieveAssets } from "@/actions/asset";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { postPayout, putPayout } from "@/actions/payout";
import { decrypt } from "@/integrations/encryption";
import { sendAssetPayment } from "@/integrations/stellar-core";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId } from "@/lib/utils";
import { Result, z as Schema } from "@stellartools/core";
import { all } from "better-all";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "app"],
  requiredAppScope: "write:payouts",
  schema: {
    body: Schema.object({
      amount: Schema.number(),
      walletAddress: Schema.string().nullable(),
      stringifiedBankAccount: Schema.string().nullable(),
      memo: Schema.string().optional(),
      assetId: Schema.string(),
      txHash: Schema.string().nullable(),
    }),
  },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    const { secret, asset } = await all({
      secret: async () => {
        const { secret: s } = await retrieveOrganizationIdAndSecret(organizationId, environment);
        if (!s) throw new Error("Merchant keys not configured, please contact support");
        return s;
      },
      asset: async () => {
        const [a] = await retrieveAssets({ id: body.assetId }, environment);
        if (!a) throw new Error("Asset not found");
        return a;
      },
    });

    const secretKey = decrypt(secret.encrypted);

    const payoutId = generateResourceId("pay", organizationId, 20);

    if (!body.walletAddress) {
      throw new Error("Wallet address is required");
    }

    const sendPayoutResult = await sendAssetPayment(
      secretKey,
      body.walletAddress,
      asset.code,
      asset.issuer!,
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
        amount: BigInt(body.amount.toString()),
        walletAddress: body.walletAddress,
        memo: body.memo ?? null,
        metadata: null,
        transactionHash: body.txHash,
        withdrawalReceiptUrl: null,
        completedAt: null,
        asset: body.assetId,
        stringifiedBankAccount: body.stringifiedBankAccount,
      },
      organizationId,
      environment
    );

    return Result.ok(payout);
  },
});
