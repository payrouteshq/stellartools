"use server";

import { paginate } from "@/actions/event";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { SAC_TOKEN_ADDRESSES } from "@/constant";
import { CreditBalance, Network, creditBalances, customers, db, payments, products } from "@/db";
import { encrypt } from "@/integrations/encryption";
import { getStellarConfig } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { generateResourceId, patchJSON } from "@/lib/utils";
import { ApiListParams } from "@/types";
import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { createHmac } from "crypto";
import { and, desc, eq } from "drizzle-orm";

export const postCreditBalance = async (
  params: Omit<CreditBalance, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt" | "settledAt">,
  orgId: string,
  env: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .insert(creditBalances)
    .values({
      id: generateResourceId("cb", organizationId, 20),
      organizationId,
      environment,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params,
    })
    .returning()
    .then(([creditBalance]) => creditBalance);
};

export const retrieveCreditBalances = safeAction(
  async (
    orgId?: string,
    env?: Network,
    filter?: { customerId?: string; productId?: string; balanceId?: string } & ApiListParams,
    options?: { withProduct?: boolean; withPayment?: boolean; withCustomer?: boolean }
  ) => {
    const limit = filter?.limit ?? 10;
    const { organizationId, environment } = await resolveOrgContext(orgId, env);

    const rows = await db
      .select({
        creditBalance: creditBalances,
        ...(options?.withProduct && { product: products }),
        ...(options?.withPayment && { payment: payments }),
        ...(options?.withCustomer && { customer: customers }),
      })
      .from(creditBalances)
      .leftJoin(payments, eq(creditBalances.paymentId, payments.id))
      .leftJoin(products, eq(creditBalances.productId, products.id))
      .leftJoin(customers, eq(creditBalances.customerId, customers.id))
      .where(
        and(
          filter?.customerId ? eq(creditBalances.customerId, filter.customerId) : undefined,
          filter?.productId ? eq(creditBalances.productId, filter.productId) : undefined,
          filter?.balanceId ? eq(creditBalances.id, filter.balanceId) : undefined,
          eq(creditBalances.organizationId, organizationId),
          eq(creditBalances.environment, environment)
        )
      )
      .orderBy(desc(creditBalances.createdAt))
      .limit(limit)
      .offset(filter?.starting_after ? parseInt(filter.starting_after) : 0);

    return await paginate(
      rows.map(({ creditBalance, product, payment, customer }) => ({
        ...creditBalance,
        product,
        payment,
        customer,
      })),
      limit
    );
  }
);

export const putCreditBalance = safeAction(
  async (id: string, retUpdate: Partial<CreditBalance>, orgId: string, env?: Network) => {
    const [
      { organizationId, environment },
      {
        data: [creditBalance],
      },
    ] = await Promise.all([
      resolveOrgContext(orgId, env),
      retrieveCreditBalances(orgId, env, { balanceId: id }, { withProduct: true, withPayment: true }),
    ]);

    if (!creditBalance) throw new AppError("Credit balance not found");

    const { metadata: metadataPatch, ...baseUpdate } = retUpdate;

    const updated = await db
      .update(creditBalances)
      .set({
        ...baseUpdate,
        updatedAt: new Date(),
        ...(metadataPatch !== undefined ? { metadata: patchJSON(creditBalance.metadata, metadataPatch) } : {}),
      })
      .where(
        and(
          eq(creditBalances.id, id),
          eq(creditBalances.organizationId, organizationId),
          eq(creditBalances.environment, environment)
        )
      )
      .returning()
      .then(([record]) => record);

    // When settling, close the on-chain channel if one exists.
    if (retUpdate.settledAt && creditBalance.channelAddress) {
      closeChannelOnChain(creditBalance, environment).catch((e) => console.error("[Channel Close Failed]", e));
    }

    return updated;
  }
);

// --- Channel Lifecycle ---

async function closeChannelOnChain(balance: CreditBalance, environment: Network): Promise<void> {
  if (!balance.channelAddress) return;

  const rpcUrl =
    environment === "testnet" ? process.env.NEXT_PUBLIC_RPC_URL_TESTNET! : process.env.NEXT_PUBLIC_RPC_URL_MAINNET!;
  const { passphrase } = getStellarConfig(environment);
  const rpcServer = new rpc.Server(rpcUrl);
  const signerKeypair = Keypair.fromSecret(process.env.KEEPER_SECRET!);
  const account = await rpcServer.getAccount(signerKeypair.publicKey());

  const seed = createHmac("sha256", process.env.MPP_SERVER_SECRET!).update(balance.id).digest();
  const commitmentKeypair = Keypair.fromRawEd25519Seed(seed);

  const cumulativeAmount = BigInt(balance.latestCumulativeAmount ?? 0);

  let sigBytes: Buffer;
  if (balance.latestSignature) {
    sigBytes = Buffer.from(balance.latestSignature, "hex");
  } else {
    sigBytes = Buffer.from(commitmentKeypair.sign(Buffer.alloc(16, 0)));
  }

  const channel = new Contract(balance.channelAddress);
  const closeOp = channel.call(
    "close",
    nativeToScVal(cumulativeAmount, { type: "i128" }),
    nativeToScVal(sigBytes, { type: "bytes" })
  );

  const tx = new TransactionBuilder(new Account(signerKeypair.publicKey(), account.sequenceNumber()), {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(closeOp)
    .setTimeout(180)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error("[Channel Close Sim Failed]", (sim as rpc.Api.SimulateTransactionErrorResponse).error);
    return;
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(signerKeypair);
  await rpcServer.sendTransaction(prepared);
}
