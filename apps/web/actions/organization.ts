"use server";

import { resolveAccountContext } from "@/actions/account";
import { runAtomic } from "@/actions/event";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import {
  Network,
  Organization,
  OrganizationSecret,
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
import { getFiatRates } from "@/integrations/price-feed";
import { createAccount } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { generateResourceId, normalizeTimeSeries } from "@/lib/utils";
import { signJwt, verifyJwt } from "@stellartools/core";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
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
      supportEmail: organizations.supportEmail,
      address: organizations.address,
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
  const token = signJwt(payload, "1y", process.env.JWT_SECRET!, process.env.JWT_ISSUER!, process.env.JWT_AUDIENCE!);

  await setCookies([
    { key: "selectedOrg", value: token, maxAge: 365 * 24 * 60 * 60 }, // 1 year
  ]);
};

export const getCurrentOrganization = async (onError?: (err: string) => Promise<void>) => {
  const selectedOrg = await getCookie("selectedOrg");

  if (!selectedOrg) return null;

  const { orgId, environment } = verifyJwt<{ orgId: string; environment: Network }>(
    selectedOrg,
    process.env.JWT_SECRET!,
    process.env.JWT_ISSUER!,
    process.env.JWT_AUDIENCE!
  );

  try {
    const organization = await retrieveOrganization(orgId);
    return { id: organization.id, environment, token: selectedOrg, selectedCurrency: organization.selectedCurrency };
  } catch (error) {
    if (onError) await onError((error as Error)?.message);
    return null;
  }
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
      mainnetSecretEncrypted: params.mainnetSecret ? `${SENSITIVE_KEY_PREFIX}${encrypt(params.mainnetSecret)}` : null,
      testnetSecretEncrypted: params.testnetSecret ? `${SENSITIVE_KEY_PREFIX}${encrypt(params.testnetSecret)}` : null,
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

/**
 * @documentation
 * MRR is not realized money. It's the snapshot: "if every active subscription renews this
 * month, how much comes in?" It's a projection of future revenue, so there's nothing to
 * deduct fees from yet.
 *
 * Revenue is realized money. It's the actual money that has come in, minus any fees that have been deducted.
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

  // 1. Fetch Fiat Rates and calculate the Target Rate multiplier
  const rates = await getFiatRates();
  const targetRate = targetCurrency === "USD" ? 1 : (rates[targetCurrency] ?? 1);

  const normalize = (amount: number | string, fromCurrency: string) => {
    const val = Number(amount);
    if (fromCurrency === targetCurrency) return val;
    const rateFrom = rates[fromCurrency] ?? 1;
    return Math.round((val / rateFrom) * targetRate);
  };

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

  // C. Gross Revenue Buckets (Excluding Succeeded Refunds)
  const excludeRefunded = sql`${payments.id} NOT IN (
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
        excludeRefunded
      )
    )
    .groupBy(payments.currencyCode);

  // D. Uncleared Platform Fees Buckets
  const feesQuery = db
    .select({
      currencyCode: charges.currencyCode,
      totalFees: sql<number>`coalesce(sum(${charges.amountCents}), 0)::int`,
    })
    .from(charges)
    .where(
      and(
        eq(charges.organizationId, organizationId),
        eq(charges.environment, environment),
        eq(charges.status, "succeeded"),
        isNull(charges.clearedAt)
      )
    )
    .groupBy(charges.currencyCode);

  // E. Time Series Data (Revenue, Customers, Subs, Trials)
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
        excludeRefunded
      )
    )
    .groupBy(sql`1`, payments.currencyCode);

  const feesChartQuery = db
    .select({
      date: sql<string>`date_trunc('day', ${charges.createdAt})::date::text`,
      currencyCode: charges.currencyCode,
      feeCents: sql<number>`coalesce(sum(${charges.amountCents}), 0)::int`,
    })
    .from(charges)
    .where(
      and(
        eq(charges.organizationId, organizationId),
        eq(charges.environment, environment),
        eq(charges.status, "succeeded"),
        isNull(charges.clearedAt),
        gte(charges.createdAt, since)
      )
    )
    .groupBy(sql`1`, charges.currencyCode);

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

  const [
    metrics,
    mrrResult,
    grossResult,
    feeResult,
    revChart,
    feeChart,
    custChart,
    trialsChart,
    activeSubscriptionsChart,
    mrrChart,
  ] = await Promise.all([
    metricsQuery,
    mrrQuery,
    grossRevenueQuery,
    feesQuery,
    revenueChartQuery,
    feesChartQuery,
    customersChartQuery,
    trialsChartQuery,
    activeSubscriptionsChartQuery,
    mrrChartQuery,
  ]);

  const mrrCents = mrrResult.reduce((acc, b) => acc + normalize(b.cents, b.currencyCode), 0);
  const totalGross = grossResult.reduce((acc, b) => acc + normalize(b.totalCents, b.currencyCode), 0);
  const totalFees = feeResult.reduce((acc, b) => acc + normalize(b.totalFees, b.currencyCode), 0);
  const netRevenueCents = totalGross - totalFees;

  const netRevMap = new Map<string, number>();
  revChart.forEach((b) =>
    netRevMap.set(b.date, (netRevMap.get(b.date) ?? 0) + normalize(b.grossCents, b.currencyCode))
  );
  feeChart.forEach((b) => netRevMap.set(b.date, (netRevMap.get(b.date) ?? 0) - normalize(b.feeCents, b.currencyCode)));

  const mrrDayMap = new Map<string, number>();
  mrrChart.forEach((b) => mrrDayMap.set(b.date, (mrrDayMap.get(b.date) ?? 0) + normalize(b.cents, b.currencyCode)));

  return {
    activeTrials: Number(metrics.activeTrials),
    activeSubscriptions: Number(metrics.activeSubscriptions),
    totalCustomers: Number(metrics.totalCustomers),
    newCustomers: custChart.reduce((acc, curr) => acc + curr.count, 0),
    mrrCents,
    netRevenueCents,
    currency: targetCurrency,
    charts: {
      mrr: normalizeTimeSeries(
        Array.from(mrrDayMap.entries()).map(([date, value]) => ({ date, value })),
        dayCount,
        "day"
      ),
      activeSubscriptions: normalizeTimeSeries(
        activeSubscriptionsChart.map((m) => ({ date: m.date, value: m.count })),
        dayCount,
        "day"
      ),
      revenue: normalizeTimeSeries(
        Array.from(netRevMap.entries()).map(([date, value]) => ({ date, value })),
        dayCount,
        "day"
      ),
      customers: normalizeTimeSeries(
        custChart.map((c) => ({ date: c.date, value: c.count })),
        dayCount,
        "day"
      ),
      trials: normalizeTimeSeries(
        trialsChart.map((t) => ({ date: t.date, value: t.count })),
        dayCount,
        "day"
      ),
    },
  };
};
