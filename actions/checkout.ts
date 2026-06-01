"use server";

import { retrieveAssets } from "@/actions/asset";
import { putCustomer } from "@/actions/customers";
import { runAtomic, withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import {
  Checkout,
  Network,
  Product,
  accounts,
  assets,
  checkouts,
  customers,
  db,
  organizationSecrets,
  organizations,
  products,
} from "@/db";
import { getLatestPagingToken } from "@/integrations/stellar-core";
import { AppError, safeAction } from "@/lib/action-handler";
import { computeDiff, generateResourceId, stroopsToXlm } from "@/lib/utils";
import { CheckoutStatus } from "@/packages/stellartools/dist/schema/checkout";
import { all } from "better-all";
import { and, eq, or, sql } from "drizzle-orm";

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

  if (params.assetCode) {
    const assetsList = await retrieveAssets(null, environment);

    const asset = assetsList.find((asset) => asset.code === params.assetCode);

    if (!asset) {
      throw new AppError(
        `Invalid asset code, Only ${assetsList.map((a) => a.code).join(", ")} are supported. Got ${params.assetCode}`
      );
    }

    params.assetCode = asset.code;
  }

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
          map: ({ productId, expiresAt, amount, customerId, id: checkoutId }) => ({
            customerId: customerId ?? undefined,
            data: {
              productId,
              expiresAt,
              amount: amount ? Number(stroopsToXlm(BigInt(amount.toString()))) : undefined,
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
            map: ({ id: checkoutId, productId, expiresAt, amount, customerId }) => ({
              object: { checkoutId, productId, expiresAt, amount, customerId },
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
        priceAmount: products.priceAmount,
        name: products.name,
        recurringPeriod: products.recurringPeriod,
        images: products.images,
        totalCredits: products.totalCredits,
        unitsPerCredit: products.unitsPerCredit,
      },
      assets: { id: assets.id, code: assets.code, issuer: assets.issuer, metadata: assets.metadata },
      finalAmount: sql<bigint>`COALESCE(${checkouts.amount}, ${products.priceAmount})`.as("final_amount"),
      merchantPublicKey: sql<string>`
      CASE 
        WHEN ${checkouts.environment} = 'testnet' THEN ${organizationSecrets.testnetPublicKey}
        ELSE ${organizationSecrets.mainnetPublicKey}
      END`.as("merchant_public_key"),
      organizationName: organizations.name,
      organizationLogo: organizations.logoUrl,
      merchantEmail: accounts.email,
    })
    .from(checkouts)
    .leftJoin(customers, eq(checkouts.customerId, customers.id))
    .leftJoin(organizationSecrets, eq(checkouts.organizationId, organizationSecrets.organizationId))
    .leftJoin(products, eq(checkouts.productId, products.id))
    .leftJoin(assets, or(eq(products.assetId, assets.id), eq(checkouts.assetCode, assets.code)))
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
    assets: assets$1,
    organizationName,
    organizationLogo,
    merchantEmail,
  } = result;

  if (!assets$1) throw new AppError(`Asset not found, Checkout must be associated with an asset`);

  return {
    ...checkout,
    merchantPublicKey,
    finalAmount: BigInt(finalAmount),
    productType: product?.type ?? "one_time",
    productName: product?.name ?? "Payment",
    recurringPeriod: product?.recurringPeriod ?? "month",
    customerEmail: customer?.email || checkout.customerEmail,
    customerPhone: customer?.phone || checkout.customerPhone,
    assetId: assets$1.id,
    assetCode: assets$1.code,
    assetIssuer: assets$1.issuer,
    productImage: product?.images?.[0] ?? null,
    customerImage: customer?.image ?? null,
    organizationName,
    organizationLogo,
    merchantEmail,
    assetMetadata: assets$1.metadata,
    productTotalCredits: product?.totalCredits,
  };
};

export const putCheckout = async (id: string, params: Partial<Checkout>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const oldCheckout = await retrieveCheckout(id, organizationId, environment);

  return withEvent(
    async () => {
      return await db
        .update(checkouts)
        .set({ ...params, updatedAt: new Date() })
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
