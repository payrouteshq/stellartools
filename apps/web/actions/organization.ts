"use server";

import { resolveAccountContext } from "@/actions/account";
import { runAtomic } from "@/actions/event";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import {
  Network,
  Organization,
  OrganizationSecret,
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
import { getFiatRates } from "@/integrations/price-feed";
import { fundAccount } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { computeOverviewStats } from "@/lib/overview-stats";
import { generateResourceId } from "@/lib/utils";
import * as StellarSDK from "@stellar/stellar-sdk";
import { STELLARTOOLS_ID, signJwt, verifyJwt } from "@stellartools/core";
import { and, eq, gte, sql } from "drizzle-orm";
import moment from "moment";

export const postOrganizationAndSecret = safeAction(
  async (
    params: Omit<Organization, "id" | "accountId">,
    defaultEnvironment: Network,
    options?: { formDataWithFiles?: FormData; externalPublicKey?: string; externalSecretKey?: string | null }
  ) => {
    const logoFile = options?.formDataWithFiles?.get("logo");

    if (logoFile) {
      const logoUploadResult = await uploadFiles([logoFile as File], { maxSizeKB: 48 });
      params.logoUrl = logoUploadResult?.[0] ?? null;
    }

    const { accountId } = await resolveAccountContext();
    const organizationId = generateResourceId("org", accountId, 25);
    const isDirect = params.walletStrategy === "direct";

    if (isDirect && !options?.externalPublicKey) {
      throw new AppError("VALIDATION_ERROR", "A Stellar public key is required for self-custody wallets");
    }

    return await runAtomic(async () => {
      const [organization] = await db
        .insert(organizations)
        .values({ ...params, id: organizationId, accountId })
        .returning();

      if (isDirect) {
        const pubKey = options!.externalPublicKey!;
        const secretKey = options?.externalSecretKey || null;

        if (!StellarSDK.StrKey.isValidEd25519PublicKey(pubKey)) {
          throw new AppError("VALIDATION_ERROR", "Invalid Stellar public key");
        }

        if (secretKey) {
          // Validate secret key using SDK and verify it pairs with the public key
          if (!StellarSDK.StrKey.isValidEd25519SecretSeed(secretKey)) {
            throw new AppError("VALIDATION_ERROR", "Invalid Stellar secret key format");
          }

          const derivedPubKey = StellarSDK.Keypair.fromSecret(secretKey).publicKey();

          if (derivedPubKey !== pubKey) {
            throw new AppError("VALIDATION_ERROR", "Secret key does not match the provided public key");
          }
        }

        await postOrganizationSecretWithEncryption(
          {
            testnetPublicKey: pubKey,
            mainnetPublicKey: pubKey,
            testnetSecret: secretKey,
            mainnetSecret: secretKey,
            testnetInitialBalance: "0",
            mainnetInitialBalance: "0",
          },
          organization.id,
          defaultEnvironment
        );
      } else {
        // One keypair for both networks — same Stellar key works on testnet and mainnet independently.
        const keypair = StellarSDK.Keypair.random();
        const [testnetResult, mainnetResult] = await Promise.all([
          fundAccount(keypair, "testnet"),
          fundAccount(keypair, "mainnet"),
        ]);

        if (testnetResult.isErr()) throw new AppError("INTERNAL_ERROR", testnetResult.error?.message);
        if (mainnetResult.isErr()) throw new AppError("INTERNAL_ERROR", mainnetResult.error?.message);

        const testnetBal = testnetResult.value?.balances.find((b) => b.asset_type === "native")?.balance ?? "0";
        const mainnetBal = mainnetResult.value?.balances.find((b) => b.asset_type === "native")?.balance ?? "0";

        await postOrganizationSecretWithEncryption(
          {
            testnetSecret: keypair.secret(),
            testnetPublicKey: keypair.publicKey(),
            mainnetSecret: keypair.secret(),
            mainnetPublicKey: keypair.publicKey(),
            testnetInitialBalance: testnetBal,
            mainnetInitialBalance: mainnetBal,
          },
          organization.id,
          defaultEnvironment
        );
      }

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
      supportEmail: organizations.supportEmail,
      address: organizations.address,
    })
    .from(organizations)
    .where(eq(organizations.accountId, accountId));

  return rows;
};

export const retrieveOrganization = async (id: string) => {
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);

  if (!organization) throw new AppError("NOT_FOUND", "Organization not found");

  return organization;
};

export const retrieveOrganizationIdAndSecret = async (id: string, environment: Network) => {
  const prefix = environment === "testnet" ? "testnet" : "mainnet";

  const [result] = await db
    .select({
      walletStrategy: organizations.walletStrategy,
      organizationId: organizations.id,
      secret: sql<{ encrypted: string; publicKey: string } | null>`
        CASE WHEN ${sql.raw(`"organization_secret"."${prefix}_secret_encrypted"`)} IS NOT NULL THEN
            jsonb_build_object(
              'encrypted', ${sql.raw(`"organization_secret"."${prefix}_secret_encrypted"`)},
              'publicKey', ${sql.raw(`"organization_secret"."${prefix}_public_key"`)}
            )
          ELSE NULL 
        END`,
    })
    .from(organizations)
    .leftJoin(organizationSecrets, eq(organizations.id, organizationSecrets.organizationId))
    .where(eq(organizations.id, id))
    .limit(1);

  if (!result) throw new AppError("NOT_FOUND", "Organization not found");

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

  const org = await retrieveOrganization(id);

  const { settings: settingsPatch, ...baseUpdate } = params;

  const [organization] = await db
    .update(organizations)
    .set({
      ...baseUpdate,
      ...(settingsPatch ? { settings: { ...(org.settings ?? {}), ...settingsPatch } } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, id))
    .returning();

  if (!organization) throw new AppError("NOT_FOUND", "Organization not found");

  return organization;
};

export const deleteOrganization = async (id: string) => {
  await db.delete(organizations).where(eq(organizations.id, id)).returning();

  return null;
};

// -- Organization Internal --

export const setCurrentOrganization = async (orgId: string, environment: Network = "testnet") => {
  const payload = { orgId, environment };
  const token = signJwt(payload, "1y", process.env.JWT_SECRET!, STELLARTOOLS_ID);

  await setCookies([
    { key: "selectedOrg", value: token, maxAge: 365 * 24 * 60 * 60 }, // 1 year
  ]);
};

export const getCurrentOrganization = async (onError?: (err: string) => Promise<void>) => {
  const selectedOrg = await getCookie("selectedOrg");

  if (!selectedOrg) return null;

  try {
    const { orgId, environment } = verifyJwt<{ orgId: string; environment: Network }>(
      selectedOrg,
      process.env.JWT_SECRET!,
      STELLARTOOLS_ID
    );

    const [row] = await db
      .select({
        id: organizations.id,
        selectedCurrency: organizations.selectedCurrency,
        name: organizations.name,
        walletStrategy: organizations.walletStrategy,
        hasSecret: sql<boolean>`(${organizationSecrets.testnetSecretEncrypted} IS NOT NULL)`,
      })
      .from(organizations)
      .leftJoin(organizationSecrets, eq(organizations.id, organizationSecrets.organizationId))
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      environment,
      token: selectedOrg,
      selectedCurrency: row.selectedCurrency,
      name: row.name,
      walletStrategy: row.walletStrategy,
      hasSecret: !!row.hasSecret,
    };
  } catch (error) {
    if (onError) await onError((error as Error)?.message);
    return null;
  }
};

export const switchEnvironment = async (environment: Network) => {
  const currentOrg = await getCurrentOrganization();

  if (!currentOrg) {
    throw new AppError("VALIDATION_ERROR", "No organization selected");
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
    throw new AppError("VALIDATION_ERROR", "No organization context found");
  }

  return {
    organizationId: orgContext.id,
    environment: orgContext.environment,
  };
};

// -- Internal --

export const postOrganizationSecretWithEncryption = async (
  params: {
    mainnetPublicKey: string | null;
    testnetPublicKey: string | null;
    testnetSecret: string | null;
    mainnetSecret: string | null;
    testnetInitialBalance: string | null;
    mainnetInitialBalance: string | null;
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
      mainnetSecretEncrypted: params.mainnetSecret ? `${SENSITIVE_KEY_PREFIX}${encrypt(params.mainnetSecret)}` : null,
      testnetSecretEncrypted: params.testnetSecret ? `${SENSITIVE_KEY_PREFIX}${encrypt(params.testnetSecret)}` : null,
      testnetInitialBalance: params.testnetInitialBalance,
      mainnetInitialBalance: params.mainnetInitialBalance,
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

  if (!secret) throw new AppError("NOT_FOUND", "Secret not found");

  return secret;
};

export const deleteOrganizationSecret = async (id: string) => {
  await db.delete(organizationSecrets).where(eq(organizationSecrets.id, id)).returning();

  return null;
};

// -- Dashboard Internals --

/**
 * @documentation
 * MRR is not realized money — it's a projection if every active subscription renews this month.
 * Gross volume is period sales analytics (DB-backed).
 */
export const retrieveOverviewStats = async (
  options: { selectedCurrency: string; orgId?: string; env?: Network; since?: Date } = {
    selectedCurrency: "USD",
  }
) => {
  const targetCurrency = options.selectedCurrency;
  const { organizationId, environment } = await resolveOrgContext(options.orgId, options.env);
  const since = options.since ?? moment().subtract(28, "days").toDate();

  const dayCount = moment().diff(moment(since), "days") + 1;

  // 1. Fetch Fiat Rates; bucket conversion happens in computeOverviewStats
  const rates = await getFiatRates();

  // A. Metrics: Subs, Trials, Total Customers
  const metricsQuery = db
    .select({
      activeSubscriptions: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'active')`,
      activeTrials: sql<number>`count(*) FILTER (WHERE ${subscriptions.status} = 'trialing')`,
      totalCustomers: sql<number>`(
        SELECT count(*) FROM ${customers} 
        WHERE ${customers.organizationId} = ${organizationId} 
        AND ${customers.environment} = ${environment}
      )`,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, organizationId), eq(subscriptions.environment, environment)))
    .then((r) => r[0]);

  // B. MRR Buckets
  const mrrQuery = db
    .select({
      currencyCode: products.currencyCode,
      cents: sql<number>`coalesce(sum(${products.priceCents}), 0)::int`,
    })
    .from(subscriptions)
    .innerJoin(products, eq(subscriptions.productId, products.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        eq(subscriptions.status, "active")
      )
    )
    .groupBy(products.currencyCode);

  // Exclude charges tied to refunded payments (paymentId IS NULL means subscription/manual charge — keep those)
  const excludeRefundedPayments = sql`${payments.id} NOT IN (
    SELECT ${refunds.paymentId} FROM ${refunds} WHERE ${refunds.status} = 'succeeded'
  )`;

  const grossRevenueQuery = db
    .select({
      currencyCode: payments.currencyCode,
      totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.environment, environment),
        eq(payments.status, "confirmed"),
        gte(payments.createdAt, since),
        excludeRefundedPayments
      )
    )
    .groupBy(payments.currencyCode);

  const revenueChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${payments.createdAt})::date::text`,
      currencyCode: payments.currencyCode,
      grossCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.environment, environment),
        eq(payments.status, "confirmed"),
        gte(payments.createdAt, since),
        excludeRefundedPayments
      )
    )
    .groupBy(sql`1`, payments.currencyCode);

  const customersChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${customers.createdAt})::date::text`,
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
    .groupBy(sql`1`);

  const trialsChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${subscriptions.createdAt})::date::text`,
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
    .groupBy(sql`1`);

  const activeSubscriptionsChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${subscriptions.createdAt})::date::text`,
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
    .groupBy(sql`1`);

  // MRR chart: value (price) of active subscriptions started each day in the window
  const mrrChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${subscriptions.createdAt})::date::text`,
      currencyCode: products.currencyCode,
      cents: sql<number>`coalesce(sum(${products.priceCents}), 0)::int`,
    })
    .from(subscriptions)
    .innerJoin(products, eq(subscriptions.productId, products.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        eq(subscriptions.status, "active"),
        gte(subscriptions.createdAt, since)
      )
    )
    .groupBy(sql`1`, products.currencyCode);

  const [metrics, mrrResult, grossResult, revChart, custChart, trialsChart, activeSubscriptionsChart, mrrChart] =
    await Promise.all([
      metricsQuery,
      mrrQuery,
      grossRevenueQuery,
      revenueChartQuery,
      customersChartQuery,
      trialsChartQuery,
      activeSubscriptionsChartQuery,
      mrrChartQuery,
    ]);

  return computeOverviewStats(
    {
      metrics,
      mrrBuckets: mrrResult.map((b) => ({ currencyCode: b.currencyCode, cents: b.cents })),
      grossBuckets: grossResult.map((b) => ({ currencyCode: b.currencyCode, cents: b.totalCents })),
      revenueChart: revChart,
      customersChart: custChart,
      trialsChart,
      activeSubscriptionsChart,
      mrrChart,
    },
    { targetCurrency, rates, dayCount }
  );
};
