"use server";

import { retrieveSupportedAssets } from "@/actions/asset";
import { putCustomer } from "@/actions/customers";
import { runAtomic, withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
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
import { computeDiff, generateResourceId, patchJSON } from "@/lib/utils";
import { CheckoutStatus } from "@stellartools/core";
import { all } from "better-all";
import { and, eq, sql } from "drizzle-orm";

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
      if (!publicKey) throw new AppError("Merchant public key not found");
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

  if (!checkout) throw new AppError("Checkout not found");

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
        totalCredits: products.totalCredits,
        unitsPerCredit: products.unitsPerCredit,
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
      merchantEmail: accounts.email,
      payoutAssetCode: organizations.payoutAssetCode,
      payoutAssetIssuer: organizations.payoutAssetIssuer,
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
    payoutAssetCode,
    payoutAssetIssuer,
  } = result;

  return {
    ...checkout,
    merchantPublicKey,
    finalAmount,
    currencyCode: product?.currencyCode ?? organizationCurrency ?? "USD",
    productType: product?.type ?? "one_time",
    productName: product?.name ?? "Payment",
    recurringPeriod: product?.recurringPeriod ?? "month",
    customerEmail: customer?.email || checkout.customerEmail,
    customerPhone: customer?.phone || checkout.customerPhone,
    productImage: product?.images?.[0] ?? null,
    customerImage: customer?.image ?? null,
    organizationName,
    organizationLogo,
    merchantEmail,
    productTotalCredits: product?.totalCredits,
    payoutAssetCode: payoutAssetCode ?? "USDC",
    payoutAssetIssuer: payoutAssetIssuer ?? null,
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

  if (!oldCheckout) throw new AppError("Checkout not found");

  const { metadata: metadataPatch, ...baseUpdate } = params;

  return withEvent(
    async () => {
      return await db
        .update(checkouts)
        .set({
          ...baseUpdate,
          updatedAt: new Date(),
          ...(metadataPatch !== undefined ? { metadata: patchJSON(oldCheckout.metadata, metadataPatch) } : {}),
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

// -- INTERNAL --

export const putCheckoutAndCustomerInternal = safeAction(
  async (
    checkoutId: string,
    data: { email: string | null; phoneNumber: string | null; customerId?: string | null },
    orgId: string,
    environment: Network
  ) => {
    await runAtomic(async () => {
      await putCheckout(checkoutId, { customerEmail: data.email, customerPhone: data.phoneNumber }, orgId, environment);

      if (data.customerId) {
        await putCustomer(data.customerId, { email: data.email, phone: data.phoneNumber }, orgId, environment);
      }
    });
  }
);
