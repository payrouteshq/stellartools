"use server";

import { resolveAccountContext } from "@/actions/account";
import { runAtomic } from "@/actions/event";
import {
  AssetMetadata,
  Network,
  Organization,
  OrganizationSecret,
  assets,
  charges,
  customers,
  db,
  organizationSecrets,
  organizations,
  payments,
  products,
  refunds,
  subscriptions,
} from "@/db";
import { getCookie, setCookies } from "@/integrations/cookie-manager";
import { encrypt } from "@/integrations/encryption";
import { uploadFiles } from "@/integrations/file-upload";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { getAssetUsdPrice } from "@/integrations/price-feed";
import { createAccount } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { generateResourceId, normalizeTimeSeries } from "@/lib/utils";
import { and, eq, gte, sql } from "drizzle-orm";
import moment from "moment";

export const postOrganizationAndSecret = safeAction(
  async (
    params: Omit<Organization, "id" | "accountId">,
    defaultEnvironment: Network,
    options?: { formDataWithFiles?: FormData }
  ) => {
    const logoFile = options?.formDataWithFiles?.get("logo");

    if (logoFile) {
      const logoUploadResult = await uploadFiles([logoFile as File], { maxSizeKB: 48 });
      params.logoUrl = logoUploadResult?.[0] ?? null;
    }

    const { accountId } = await resolveAccountContext();

    const organizationId = generateResourceId("org", accountId, 25);

    return await runAtomic(async () => {
      const [organization] = await db
        .insert(organizations)
        .values({ ...params, id: organizationId, accountId })
        .returning();

      // todo: drop `defaultEnvironment` prop and parallelize request for testnet and mainnet.
      const account = await createAccount(defaultEnvironment);

      if (account.isErr()) throw new AppError(account.error?.message);

      postOrganizationSecretWithEncryption(
        {
          testnetSecret: account.value!.keypair.secret(),
          testnetSecretVersion: parseInt(process.env.NEXT_PUBLIC_CURRENT_ENCRYPTION_KEY_VERSION!) || 1,
          testnetPublicKey: account.value!.keypair.publicKey(),
          mainnetSecret: null,
          mainnetPublicKey: null,
          mainnetSecretVersion: 0,
        },
        organization.id,
        defaultEnvironment
      );

      return organization;
    })
      .then((organization) => {
        return { success: true, id: organization.id };
      })
      .catch((error) => {
        return { success: false, error: error.message };
      });
  }
);

export const retrieveOrganizations = async (accId?: string) => {
  const { accountId } = await resolveAccountContext(accId);

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      logoUrl: organizations.logoUrl,
    })
    .from(organizations)
    .where(eq(organizations.accountId, accountId));

  return rows;
};

export const retrieveOrganization = async (id: string) => {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);

  if (!organization) throw new AppError("Organization not found");

  return organization;
};

export const retrieveOrganizationIdAndSecret = async (id: string, environment: Network) => {
  const prefix = environment === "testnet" ? "testnet" : "mainnet";

  const [result] = await db
    .select({
      organizationId: organizations.id,
      secret: sql<{ encrypted: string; version: number; publicKey: string } | null>`
        CASE WHEN ${sql.raw(`"organization_secret"."${prefix}_secret_encrypted"`)} IS NOT NULL THEN
            jsonb_build_object(
              'encrypted', ${sql.raw(`"organization_secret"."${prefix}_secret_encrypted"`)},
              'version', ${sql.raw(`"organization_secret"."${prefix}_secret_version"`)},
              'publicKey', ${sql.raw(`"organization_secret"."${prefix}_public_key"`)}
            )
          ELSE NULL 
        END`,
    })
    .from(organizations)
    .leftJoin(organizationSecrets, eq(organizations.id, organizationSecrets.organizationId))
    .where(eq(organizations.id, id))
    .limit(1);

  if (!result) throw new AppError("Organization not found");

  return result;
};

export const putOrganization = async (
  id: string,
  params: Partial<Organization>,
  options?: { formDataWithFiles?: FormData }
) => {
  const logoFile = options?.formDataWithFiles?.get("logo");

  if (logoFile) {
    const logoUploadResult = await uploadFiles([logoFile as File], { maxSizeKB: 48 });
    params.logoUrl = logoUploadResult?.[0] ?? null;
  }

  const [organization] = await db
    .update(organizations)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();

  if (!organization) throw new AppError("Organization not found");

  return organization;
};

export const deleteOrganization = async (id: string) => {
  await db.delete(organizations).where(eq(organizations.id, id)).returning();

  return null;
};

// -- Organization Internal --

export const setCurrentOrganization = async (orgId: string, environment: Network = "testnet") => {
  const payload = { orgId, environment };
  const token = signJwt(payload, "1y");

  await setCookies([
    { key: "selectedOrg", value: token, maxAge: 365 * 24 * 60 * 60 }, // 1 year
  ]);
};

export const getCurrentOrganization = async () => {
  const selectedOrg = await getCookie("selectedOrg");

  if (!selectedOrg) return null;

  const { orgId, environment } = verifyJwt<{ orgId: string; environment: Network }>(selectedOrg);

  const organization = await retrieveOrganization(orgId);

  return { id: organization.id, environment, token: selectedOrg };
};

export const switchEnvironment = async (environment: Network) => {
  const currentOrg = await getCurrentOrganization();

  if (!currentOrg) {
    throw new AppError("No organization selected");
  }

  await setCurrentOrganization(currentOrg.id, environment);
};

export const resolveOrgContext = async (
  organizationId?: string,
  environment?: Network
): Promise<{ organizationId: string; environment: Network }> => {
  if (organizationId && environment) {
    return { organizationId, environment };
  }

  const orgContext = await getCurrentOrganization();

  if (!orgContext) {
    throw new AppError("No organization context found");
  }

  return {
    organizationId: orgContext.id,
    environment: orgContext.environment,
  };
};

// -- Organization Secrets --

export const retrieveOrganizationSecrets = async (organizationId: string) => {
  const secrets = await db
    .select()
    .from(organizationSecrets)
    .where(eq(organizationSecrets.organizationId, organizationId));

  return secrets;
};

export const retrieveOrganizationSecret = async (id: string) => {
  const [secret] = await db.select().from(organizationSecrets).where(eq(organizationSecrets.id, id)).limit(1);

  return secret;
};

// -- Internal --

export const postOrganizationSecretWithEncryption = async (
  params: {
    mainnetPublicKey: string | null;
    testnetPublicKey: string | null;
    testnetSecretVersion: number;
    mainnetSecretVersion: number;
    testnetSecret: string | null;
    mainnetSecret: string | null;
  },
  orgId?: string,
  env?: Network
) => {
  const { organizationId } = await resolveOrgContext(orgId, env);

  const [secret] = await db
    .insert(organizationSecrets)
    .values({
      mainnetPublicKey: params.mainnetPublicKey,
      testnetPublicKey: params.testnetPublicKey,
      mainnetSecretVersion: params.testnetSecretVersion,
      testnetSecretVersion: params.testnetSecretVersion,
      mainnetSecretEncrypted: params.mainnetSecret ? encrypt(params.mainnetSecret) : null,
      testnetSecretEncrypted: params.testnetSecret ? encrypt(params.testnetSecret) : null,
      id: generateResourceId("org_sec", organizationId, 25),
      organizationId,
    })
    .returning();

  return secret;
};

export const putOrganizationSecretWithEncryption = async (id: string, params: Partial<OrganizationSecret>) => {
  const [secret] = await db
    .update(organizationSecrets)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(organizationSecrets.id, id))
    .returning();

  if (!secret) throw new AppError("Secret not found");

  return secret;
};

export const deleteOrganizationSecret = async (id: string) => {
  await db.delete(organizationSecrets).where(eq(organizationSecrets.id, id)).returning();

  return null;
};

// -- Dashboard Internals --

export const retrieveOverviewStats = async (options: { orgId?: string; env?: Network; since?: Date } = {}) => {
  const { organizationId, environment } = await resolveOrgContext(options.orgId, options.env);
  const since = options.since ?? moment().subtract(28, "days").toDate();

  // 1. Basic Counts
  const metricsQuery = db
    .select({
      activeSubscriptions: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'active')`,
      activeTrials: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'trialing')`,
      totalCustomers: sql<number>`(SELECT count(*) FROM ${customers} WHERE ${customers.organizationId} = ${organizationId} AND ${customers.environment} = ${environment})`,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, organizationId), eq(subscriptions.environment, environment)))
    .then((r) => r[0]);

  // 2. MRR (Based on active product prices)
  const mrrQuery = db
    .select({
      assetMetadata: assets.metadata,
      totalAmount: sql<number>`coalesce(sum(${products.priceAmount}), 0)::bigint`,
    })
    .from(subscriptions)
    .innerJoin(products, eq(subscriptions.productId, products.id))
    .innerJoin(assets, eq(products.assetId, assets.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        eq(subscriptions.status, "active")
      )
    )
    .groupBy(assets.id);

  // 3. Gross Revenue (Confirmed payments minus successful refunds)
  const excludeRefunded = sql`${payments.id} NOT IN (SELECT ${refunds.paymentId} FROM ${refunds} WHERE ${refunds.status} = 'succeeded')`;

  const revenueQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${payments.createdAt})::text`,
      assetMetadata: assets.metadata,
      amount: sql<number>`sum(${payments.amount})::bigint`,
    })
    .from(payments)
    .leftJoin(assets, eq(payments.assetId, assets.id))
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.environment, environment),
        eq(payments.status, "confirmed"),
        gte(payments.createdAt, since),
        excludeRefunded
      )
    )
    .groupBy(sql`date_trunc('day', ${payments.createdAt})`, assets.id);

  // 4. Platform Fees (Used to calculate Net Revenue)
  // query by day to align with the revenue chart
  const feesChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${charges.createdAt})::text`,
      amountUsd: sql<number>`sum(${charges.amountUsdCents})::int`,
    })
    .from(charges)
    .where(
      and(
        eq(charges.organizationId, organizationId),
        eq(charges.environment, environment),
        eq(charges.status, "succeeded"),
        gte(charges.createdAt, since)
      )
    )
    .groupBy(sql`date_trunc('day', ${charges.createdAt})`);

  // 5. Chart Data (Customers, Trials, Subscriptions)
  const customersChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${customers.createdAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.environment, environment),
        gte(customers.createdAt, since)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const trialsChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${subscriptions.createdAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        eq(subscriptions.status, "trialing"),
        gte(subscriptions.createdAt, since)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const subscriptionsChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${subscriptions.createdAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        eq(subscriptions.status, "active"),
        gte(subscriptions.createdAt, since)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const [metrics, mrrData, revenueData, feesChartData, customersChart, trialsChart, subscriptionsChart] =
    await Promise.all([
      metricsQuery,
      mrrQuery,
      revenueQuery,
      feesChartQuery,
      customersChartQuery,
      trialsChartQuery,
      subscriptionsChartQuery,
    ]);

  const convertToUsdCents = async (rows: { totalAmount?: number; amount?: number; assetMetadata: AssetMetadata }[]) => {
    let total = 0;
    for (const row of rows) {
      const amount = row.totalAmount ?? row.amount ?? 0;
      const price = await getAssetUsdPrice(row.assetMetadata ?? {});
      total += (Number(amount) / 1e7) * price * 100;
    }
    return Math.round(total);
  };

  const [mrrCents, grossRevenueCents] = await Promise.all([
    convertToUsdCents(mrrData as any),
    convertToUsdCents(revenueData as any),
  ]);

  const totalFeesCents = feesChartData.reduce((acc, curr) => acc + (curr.amountUsd ?? 0), 0);

  const revenueChartPoints = await (async () => {
    const netByDate = new Map<string, number>();

    // Add Gross Revenue
    for (const r of revenueData) {
      const date = r.date.split(" ")[0];
      const price = await getAssetUsdPrice(r.assetMetadata ?? {});
      const cents = (Number(r.amount) / 1e7) * price * 100;
      netByDate.set(date, (netByDate.get(date) ?? 0) + cents);
    }

    // Subtract Platform Fees
    for (const f of feesChartData) {
      const date = f.date.split(" ")[0];
      const feeCents = f.amountUsd ?? 0;
      netByDate.set(date, (netByDate.get(date) ?? 0) - feeCents);
    }

    return Array.from(netByDate.entries()).map(([date, value]) => ({
      date,
      value: Math.round(value),
    }));
  })();

  return {
    activeTrials: Number(metrics.activeTrials),
    activeSubscriptions: Number(metrics.activeSubscriptions),
    mrr: mrrCents,
    revenue: grossRevenueCents - totalFeesCents, // NET REVENUE
    totalCustomers: Number(metrics.totalCustomers),
    newCustomers: customersChart.reduce((acc, curr) => acc + curr.count, 0),
    charts: {
      revenue: normalizeTimeSeries(revenueChartPoints, 28, "day"),
      customers: normalizeTimeSeries(
        customersChart.map((c) => ({ date: c.date.split(" ")[0], count: c.count })),
        28,
        "day"
      ),
      subscriptions: normalizeTimeSeries(
        subscriptionsChart.map((s) => ({ date: s.date.split(" ")[0], count: s.count })),
        28,
        "day"
      ),
      trials: normalizeTimeSeries(
        trialsChart.map((t) => ({ date: t.date.split(" ")[0], count: t.count })),
        28,
        "day"
      ),
    },
  };
};
