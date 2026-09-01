import { processFiatPayoutFunding, reconcileFiatPayout } from "@/actions/offramp";
import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { putPayout } from "@/actions/payout";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Payout, db, payouts } from "@/db";
import { getAnchorConfig } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { mapSep24Status } from "@/integrations/anchor/status";
import { decrypt } from "@/integrations/encryption";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";
import { and, eq } from "drizzle-orm";

const paramsSchema = Schema.object({ payoutId: Schema.string() });

export const OPTIONS = createOptionsHandler();

async function retrieveFiatPayout(params: {
  payoutId: string;
  organizationId: string;
  environment: "testnet" | "mainnet";
}): Promise<Payout> {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(
      and(
        eq(payouts.id, params.payoutId),
        eq(payouts.organizationId, params.organizationId),
        eq(payouts.environment, params.environment)
      )
    )
    .limit(1);
  if (!payout || payout.method !== "fiat") throw new AppError("NOT_FOUND", "Fiat payout not found");
  if (!payout.provider || !payout.providerTransactionId) {
    throw new AppError("CONFLICT", "The payout provider session has not been created");
  }
  return payout;
}

async function createProviderClient(payout: Payout): Promise<{
  client: Sep24Client;
  secretKey: string;
  config: ReturnType<typeof getAnchorConfig>;
}> {
  const config = getAnchorConfig(payout.environment, payout.provider ?? undefined);
  const { secret } = await retrieveOrganizationIdAndSecret(payout.organizationId, payout.environment);
  if (!secret) throw new AppError("VALIDATION_ERROR", "Merchant Stellar wallet is not configured");
  const secretKey = decrypt(secret.encrypted.replace(SENSITIVE_KEY_PREFIX, ""));
  const toml = await discoverAnchor(config);
  const token = await authenticateWithSep10({ config, toml, accountSecret: secretKey });
  return { client: new Sep24Client(config, toml, token), secretKey, config };
}

export const GET = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  schema: { params: paramsSchema },
  handler: async ({ params: { payoutId }, auth: { organizationId, environment } }) => {
    const payout = await retrieveFiatPayout({ payoutId, organizationId, environment });
    const reconciled = await reconcileFiatPayout(payout);

    return Result.ok({
      id: payout.id,
      status: reconciled.status,
      providerStatus: reconciled.providerStatus,
      requiresFundingConfirmation:
        reconciled.providerStatus === "pending_user_transfer_start" && !reconciled.transactionHash,
      transactionHash: reconciled.transactionHash ?? payout.transactionHash,
    });
  },
});

export const POST = apiHandler({
  auth: ["session"],
  convertToSnakeCase: false,
  schema: { params: paramsSchema },
  handler: async ({ params: { payoutId }, auth: { organizationId, environment } }) => {
    const payout = await retrieveFiatPayout({ payoutId, organizationId, environment });
    const { client, secretKey } = await createProviderClient(payout);
    const transaction = await client.getTransaction(payout.providerTransactionId!);
    const localStatus = mapSep24Status(transaction.status);

    await putPayout(payout.id, {
      status: localStatus,
      providerStatus: transaction.status,
      providerUpdatedAt: new Date(),
    });

    if (transaction.status !== "pending_user_transfer_start") {
      return Result.ok({
        id: payout.id,
        status: localStatus,
        providerStatus: transaction.status,
        funded: !!payout.transactionHash,
        transactionHash: payout.transactionHash,
      });
    }

    if (payout.transactionHash) {
      return Result.ok({
        id: payout.id,
        status: "pending" as const,
        providerStatus: transaction.status,
        funded: true,
        transactionHash: payout.transactionHash,
      });
    }

    try {
      const { transactionHash } = await processFiatPayoutFunding(payout, secretKey, transaction);
      return Result.ok({
        id: payout.id,
        status: "pending" as const,
        providerStatus: transaction.status,
        funded: true,
        transactionHash,
      });
    } catch {
      throw new AppError("STELLAR_ERROR", "The Stellar funding payment could not be submitted");
    }
  },
});

