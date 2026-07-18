"use server";

import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { sweepAndProcessPayment } from "@/actions/payment";
import { Network } from "@/constant/schema.client";
import { db } from "@/db";
import { charges, organizationSecrets, payments, payouts, refunds } from "@/db/schema";
import { getStellarConfig } from "@/integrations/stellar-core";
import * as StellarSDK from "@stellar/stellar-sdk";
import { and, eq, isNotNull, sql } from "drizzle-orm";

export type ReconReport = {
  assetCode: string;
  dbNetBalance: number;
  chainActualBalance: number;
  drift: number;
  status: "synced" | "diverged";
};

const DRIFT_THRESHOLD = 1;

export async function reconcileOrganization(orgId?: string, env?: Network): Promise<ReconReport[]> {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);
  const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);

  if (!secret?.publicKey) return [];

  const { server } = getStellarConfig(environment);
  const account = await server.loadAccount(secret.publicKey);

  const [baseRow] = await db
    .select({
      balance:
        environment === "testnet"
          ? organizationSecrets.testnetInitialBalance
          : organizationSecrets.mainnetInitialBalance,
    })
    .from(organizationSecrets)
    .where(eq(organizationSecrets.organizationId, organizationId));

  const assetRows = await db
    .selectDistinct({ code: payments.selectedAssetCode })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.environment, environment),
        eq(payments.status, "confirmed")
      )
    );

  return Promise.all(
    assetRows.map(async ({ code }) => {
      const [paymentsRow, payoutsRow, refundsRow, chargesRow] = await Promise.all([
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${payments.cryptoAmount} AS NUMERIC)), '0')` })
          .from(payments)
          .where(
            and(
              eq(payments.organizationId, organizationId),
              eq(payments.environment, environment),
              eq(payments.status, "confirmed"),
              eq(payments.selectedAssetCode, code)
            )
          ),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${payouts.cryptoAmount} AS NUMERIC)), '0')` })
          .from(payouts)
          .where(
            and(
              eq(payouts.organizationId, organizationId),
              eq(payouts.environment, environment),
              eq(payouts.status, "succeeded"),
              eq(payouts.selectedAssetCode, code)
            )
          ),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${refunds.cryptoAmount} AS NUMERIC)), '0')` })
          .from(refunds)
          .where(
            and(
              eq(refunds.organizationId, organizationId),
              eq(refunds.environment, environment),
              eq(refunds.status, "succeeded"),
              eq(refunds.selectedAssetCode, code)
            )
          ),
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${charges.cryptoAmount} AS NUMERIC)), '0')` })
          .from(charges)
          .where(
            and(
              eq(charges.organizationId, organizationId),
              eq(charges.environment, environment),
              eq(charges.status, "succeeded"),
              eq(charges.selectedAssetCode, code)
            )
          ),
      ]);

      const inflow = Number(paymentsRow[0]?.total ?? 0);
      const outPayouts = Number(payoutsRow[0]?.total ?? 0);
      const outRefunds = Number(refundsRow[0]?.total ?? 0);
      const outCharges = Number(chargesRow[0]?.total ?? 0);

      const genesisBalance = Number(baseRow?.balance ?? 0);

      const dbNetBalance = genesisBalance + inflow - outPayouts - outRefunds - outCharges;

      const balanceEntry =
        code === "XLM"
          ? account.balances.find((b) => b.asset_type === "native")
          : account.balances.find(
              (b): b is StellarSDK.Horizon.HorizonApi.BalanceLineAsset => "asset_code" in b && b.asset_code === code
            );

      const chainActualBalance = Number(balanceEntry?.balance ?? 0);
      const drift = Math.abs(dbNetBalance - chainActualBalance);

      return {
        assetCode: code,
        dbNetBalance,
        chainActualBalance,
        drift,
        status: drift <= DRIFT_THRESHOLD ? "synced" : "diverged",
      } satisfies ReconReport;
    })
  );
}

export async function healGhostPayments(orgId?: string, env?: Network): Promise<number> {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);
  const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);

  if (!secret?.publicKey) return 0;

  const { server } = getStellarConfig(environment);

  const txPage = await server.transactions().forAccount(secret.publicKey).order("desc").limit(50).call();

  const candidates = txPage.records.filter(
    (tx) => tx.successful && typeof tx.memo === "string" && (tx.memo as string).startsWith("cz_")
  );

  if (!candidates.length) return 0;

  const existingHashes = new Set(
    (
      await db
        .select({ hash: payments.transactionHash })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            eq(payments.environment, environment),
            isNotNull(payments.transactionHash)
          )
        )
    ).map((r) => r.hash)
  );

  const ghosts = candidates.filter((tx) => !existingHashes.has(tx.hash));

  for (const tx of ghosts) {
    try {
      await sweepAndProcessPayment(tx.memo as string);
    } catch {
      // best-effort
    }
  }

  return ghosts.length;
}
