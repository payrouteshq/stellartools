"use server";

import { retrieveSupportedAssets } from "@/actions/asset";
import { putCustomer, upsertCustomer } from "@/actions/customers";
import { runAtomic, withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrieveProducts } from "@/actions/product";
import { subscriptionPeriodMs } from "@/constant";
import {
  Checkout,
  Network,
  Product,
  accounts,
  checkouts,
  customers,
  db,
  organizationSecrets,
  organizations,
  products,
} from "@/db";
import { getAssetUsdPrice, getFiatRates } from "@/integrations/price-feed";
import { getLatestPagingToken } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { computeDiff, generateResourceId } from "@/lib/utils";
import { CheckoutStatus } from "@stellartools/core";
import { all } from "better-all";
import { and, eq, sql } from "drizzle-orm";
import moment from "moment";

export const postCheckout = async (
  params: Omit<Checkout, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt" | "initialPagingToken">,
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const { token } = await all({
    secret: async () => await retrieveOrganizationIdAndSecret(organizationId, environment),
    async token() {
      const publicKey = (await this.$.secret).secret?.publicKey;
      if (!publicKey) throw new AppError("VALIDATION_ERROR", "Merchant public key not found");
      return await getLatestPagingToken(publicKey, environment);
    },
  });

  const checkoutId = generateResourceId("cz", organizationId, 20);

  return withEvent(
    async () => {
      const [checkout] = await db
        .insert(checkouts)
        .values({ ...params, id: checkoutId, organizationId, environment, initialPagingToken: token })
        .returning();

      return checkout;
    },
    {
      events: [
        {
          type: "checkout::created",
          map: ({ productId, expiresAt, amountCents, customerId, id: checkoutId }) => ({
            customerId: customerId ?? undefined,
            data: {
              productId,
              expiresAt,
              ...(amountCents ? { amount: Money.formatFiat(amountCents ?? 0) } : {}),
              checkoutId,
              externalUrl: `${process.env.NEXT_PUBLIC_CHECKOUT_URL!}/${checkoutId}`,
            },
          }),
        },
      ],
      webhooks: {
        organizationId,
        environment,
        triggers: [
          {
            event: "checkout.created",
            map: ({ id: checkoutId, productId, expiresAt, amountCents, customerId }) => ({
              object: {
                checkoutId,
                productId,
                expiresAt,
                amount: Money.formatFiat(amountCents ?? 0),
                customerId,
              },
              previous_attributes: undefined,
            }),
          },
        ],
      },
    }
  );
};

export const retrieveCheckouts = async (
  orgId?: string,
  env?: Network,
  parameters?: { status?: CheckoutStatus },
  overrideOrganizationContext?: boolean,
  options?: { withProduct?: boolean }
): Promise<{ checkout: Checkout; product?: Product }[]> => {
  if (overrideOrganizationContext) {
    return await db
      .select({
        checkout: checkouts,
      })
      .from(checkouts)
      .where(and(...(parameters?.status ? [eq(checkouts.status, parameters.status)] : [])));
  }

  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .select({
      checkout: checkouts,
      product: products,
    })
    .from(checkouts)
    .where(
      and(
        eq(checkouts.organizationId, organizationId),
        eq(checkouts.environment, environment),
        ...(parameters?.status ? [eq(checkouts.status, parameters.status)] : []),
        ...(options?.withProduct ? [eq(checkouts.productId, products.id)] : [])
      )
    );
};

export const retrieveCheckout = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [checkout] = await db
    .select()
    .from(checkouts)
    .where(
      and(eq(checkouts.id, id), eq(checkouts.organizationId, organizationId), eq(checkouts.environment, environment))
    );

  if (!checkout) throw new AppError("NOT_FOUND", "Checkout not found");

  return checkout;
};

export const retrieveCheckoutAndCustomer = async (id: string) => {
  const [result] = await db
    .select({
      checkout: checkouts,
      customer: customers,
      product: {
        type: products.type,
        priceCents: products.priceCents,
        currencyCode: products.currencyCode,
        name: products.name,
        recurringPeriod: products.recurringPeriod,
        customDurationMs: products.customDurationMs,
        images: products.images,
      },
      finalAmount: sql<number>`COALESCE(${checkouts.amountCents}, ${products.priceCents})`.as("final_amount"),
      merchantPublicKey: sql<string>`
      CASE
        WHEN ${checkouts.environment} = 'testnet' THEN ${organizationSecrets.testnetPublicKey}
        ELSE ${organizationSecrets.mainnetPublicKey}
      END`.as("merchant_public_key"),
      organizationName: organizations.name,
      organizationLogo: organizations.logoUrl,
      organizationCurrency: organizations.selectedCurrency,
      walletStrategy: organizations.walletStrategy,
      merchantEmail: accounts.email,
    })
    .from(checkouts)
    .leftJoin(customers, eq(checkouts.customerId, customers.id))
    .leftJoin(organizationSecrets, eq(checkouts.organizationId, organizationSecrets.organizationId))
    .leftJoin(products, eq(checkouts.productId, products.id))
    .leftJoin(organizations, eq(checkouts.organizationId, organizations.id))
    .leftJoin(accounts, eq(organizations.accountId, accounts.id))
    .where(eq(checkouts.id, id));

  if (!result) return null;

  const {
    checkout,
    customer,
    finalAmount,
    merchantPublicKey,
    product,
    organizationName,
    organizationLogo,
    organizationCurrency,
    merchantEmail,
  } = result;

  return {
    ...checkout,
    merchantPublicKey,
    finalAmount,
    currencyCode: product?.currencyCode ?? checkout.currencyCode ?? organizationCurrency ?? "USD",
    productType: product?.type ?? "one_time",
    productName: product?.name ?? checkout.description ?? "Payment",
    recurringPeriod: product?.recurringPeriod ?? "month",
    customerEmail: customer?.email || checkout.customerEmail,
    customerPhone: customer?.phone || checkout.customerPhone,
    productImage: product?.images?.[0] ?? null,
    customerImage: customer?.image ?? null,
    organizationName,
    organizationLogo,
    merchantEmail,
    walletStrategy: result.walletStrategy ?? "managed",
    customDurationMs: product?.customDurationMs,
  };
};

export const retrieveCheckoutPublicData = async (checkoutId: string) => {
  const [row] = await db
    .select({ environment: checkouts.environment, organizationId: checkouts.organizationId })
    .from(checkouts)
    .where(eq(checkouts.id, checkoutId));

  if (!row) return null;

  const [orgRow] = await db
    .select({ selectedCurrency: organizations.selectedCurrency })
    .from(organizations)
    .where(eq(organizations.id, row.organizationId));

  const assets = await retrieveSupportedAssets(null, row.environment);

  const [fiatRates, ...assetPriceResults] = await Promise.all([
    getFiatRates(),
    ...assets.map((a) => getAssetUsdPrice(a.metadata ?? {}).then((price) => ({ code: a.code, price }))),
  ]);

  const assetUsdPrices = Object.fromEntries(assetPriceResults.map((r) => [r.code, r.price]));

  return {
    assets,
    fiatRates: fiatRates as Record<string, number>,
    assetUsdPrices,
    orgCurrency: orgRow.selectedCurrency,
  };
};

export const putCheckout = async (id: string, params: Partial<Checkout>, orgId?: string, env?: Network) => {
  const [{ organizationId, environment }, oldCheckout] = await Promise.all([
    resolveOrgContext(orgId, env),
    retrieveCheckout(id, orgId, env),
  ]);

  if (!oldCheckout) throw new AppError("NOT_FOUND", "Checkout not found");

  const { metadata: metadataPatch, ...baseUpdate } = params;

  return withEvent(
    async () => {
      return await db
        .update(checkouts)
        .set({
          ...baseUpdate,
          updatedAt: new Date(),
          ...(metadataPatch !== undefined ? { metadata: { ...(oldCheckout.metadata ?? {}), ...metadataPatch } } : {}),
        })
        .where(
          and(
            eq(checkouts.id, id),
            eq(checkouts.organizationId, organizationId),
            eq(checkouts.environment, environment)
          )
        )
        .returning()
        .then(([checkout]) => checkout);
    },
    {
      events: [
        {
          type: "checkout::updated",
          map: (checkout) => ({
            checkoutId: checkout.id,
            data: {
              id: checkout.id,
              productId: checkout.productId,
              $changes: computeDiff(oldCheckout, checkout, undefined, "."),
            },
          }),
        },
      ],
      webhooks: { organizationId, environment, triggers: [] },
    }
  );
};

export const deleteCheckout = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  await db
    .delete(checkouts)
    .where(
      and(eq(checkouts.id, id), eq(checkouts.organizationId, organizationId), eq(checkouts.environment, environment))
    )
    .returning();

  return null;
};

export const createProductCheckoutSession = async (params: {
  productId: string;
  orgId: string;
  env: Network;
  customer?: { id?: string | null; email?: string | null; phone?: string | null };
  subscription?: { trialDays?: number; cancelAtPeriodEnd?: boolean } | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
  redirectUrl?: string | null;
}) => {
  const { productId, orgId, env } = params;

  const {
    data: [product],
  } = await retrieveProducts(orgId, env, { productId });

  if (!product) throw new AppError("NOT_FOUND", `Product Not Found ${productId}`);

  if (product.type === "subscription") {
    const { secret } = await retrieveOrganizationIdAndSecret(orgId, env);
    if (!secret?.encrypted) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Subscription checkouts require a stored secret key. Contact us at support@stellartools.dev to enable subscriptions."
      );
    }
  }

  if (product.type === "subscription" && !product.recurringPeriod) {
    throw new AppError("VALIDATION_ERROR", "Subscription product does not have a recurring period");
  }

  const durationMs = subscriptionPeriodMs(product.recurringPeriod, product.customDurationMs);

  if (!durationMs && product.type === "subscription") {
    throw new AppError("VALIDATION_ERROR", "Subscription product has an invalid billing period");
  }

  let customerId: string | null = null;
  let customerEmail: string | null = params.customer?.email ?? null;
  let customerPhone: string | null = params.customer?.phone ?? null;

  if (params.customer?.id || params.customer?.email || params.customer?.phone) {
    const customer = await upsertCustomer(params.customer, orgId, env, {
      name: params.customer?.email?.split("@")[0] ?? "Guest",
    });
    customerId = customer.id;
    customerEmail = customer.email;
    customerPhone = customer.phone;
  }

  let subscriptionData = null;

  if (product.type === "subscription") {
    const trialDays = params.subscription?.trialDays ?? 0;
    const periodStart = moment().toISOString();
    const cancelAtPeriodEnd = params.subscription?.cancelAtPeriodEnd ?? false;

    subscriptionData =
      trialDays > 0
        ? {
            period_start: periodStart,
            period_end: moment().add(trialDays, "days").toISOString(),
            cancel_at_period_end: cancelAtPeriodEnd,
            trial_days: trialDays,
          }
        : {
            period_start: periodStart,
            period_end: moment().add(durationMs, "milliseconds").toISOString(),
            cancel_at_period_end: cancelAtPeriodEnd,
          };
  }

  return await postCheckout(
    {
      customerId,
      customerEmail,
      customerPhone,
      status: "open",
      expiresAt: new Date(Date.now() + 864e5),
      metadata: params.metadata ?? {},
      description: params.description ?? null,
      redirectUrl: params.redirectUrl ?? null,
      subscriptionData,
      productId,
      currencyCode: null,
      amountCents: null,
    } as Parameters<typeof postCheckout>[0],
    orgId,
    env
  );
};

// -- INTERNAL --

export const putCheckoutAndCustomerInternal = safeAction(
  async (
    checkoutId: string,
    data: { email: string; phoneNumber: string; customerId?: string | null },
    orgId: string,
    environment: Network
  ) => {
    await runAtomic(async () => {
      let finalCustomerId = data.customerId;

      // If checkout was anonymous, create/find the customer row NOW
      if (!finalCustomerId) {
        const customer = await upsertCustomer({ email: data.email }, orgId, environment, {
          name: data.email.split("@")[0],
          phone: data.phoneNumber,
        });
        finalCustomerId = customer.id;
      }

      // 1. Link the checkout to the customer
      await putCheckout(
        checkoutId,
        {
          customerEmail: data.email,
          customerPhone: data.phoneNumber,
          customerId: finalCustomerId,
        },
        orgId,
        environment
      );

      // 2. Ensure customer record is updated with latest details
      await putCustomer(finalCustomerId, { email: data.email, phone: data.phoneNumber }, orgId, environment);
    });
  }
);
