"use server";

import { deleteEvents, paginate, withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import {
  Customer,
  CustomerMetadata,
  Network,
  ResolvedCustomer,
  creditBalances as creditBalancesSchema,
  customerPortalSessions,
  customerWallets,
  customers as customersSchema,
  db,
  organizations,
  payments as paymentsSchema,
  products as productsSchema,
  subscriptions as subscriptionsSchema,
} from "@/db";
import { CustomerWallet as CustomerWalletSchema } from "@/db";
import { uploadFiles } from "@/integrations/file-upload";
import { AppError } from "@/lib/action-handler";
import { computeDiff, generateResourceId } from "@/lib/utils";
import { patchJSON } from "@/lib/utils";
import { ApiListParams, PaginatedResult } from "@/types";
import { MaybeArray } from "@stellartools/core";
import crypto from "crypto";
import { SQL, and, desc, eq, gt, inArray } from "drizzle-orm";
import moment from "moment";

export const createCustomerImage = async (formData: FormData): Promise<string | undefined> => {
  const imageFile = formData.get("image");

  if (imageFile) {
    const uploadResult = await uploadFiles([imageFile as File], { maxSizeKB: 48 });
    return uploadResult?.[0] ?? undefined;
  }

  return undefined;
};

export const postCustomers = async (
  params: Omit<Customer, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt">[],
  orgId?: string,
  env?: Network,
  options?: { source?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return withEvent(
    async () => {
      const results = await db
        .insert(customersSchema)
        .values(
          params.map((p) => ({ ...p, id: generateResourceId("cus", organizationId, 20), organizationId, environment }))
        )
        .returning();

      return results;
    },
    (customers) => {
      const data = customers.map(({ id, name, email, phone, metadata, image }) => ({
        id,
        name,
        email,
        phone,
        metadata,
        image,
        ...(options?.source ? { source: options.source } : {}),
      }));

      return {
        events: [
          {
            type: "customer::created",
            map: () => data.map((c) => ({ customerId: c.id, data: c })),
          },
        ],
        webhooks: {
          organizationId,
          environment,
          triggers: [
            ...data.map(({ source: _, ...c }) => ({
              event: "customer.created",
              map: () => ({ object: c, previous_attributes: undefined }),
            })),
          ],
        },
      };
    }
  );
};

type CustomerLookup = { id?: string | null } | { email?: string | null } | { phone?: string | null };

export const retrieveCustomers = async (
  params?: MaybeArray<CustomerLookup> & ApiListParams,
  options?: { withWallets?: boolean; requireLookUpParams?: boolean },
  orgId?: string,
  env?: Network
): Promise<PaginatedResult<ResolvedCustomer>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const lookup = Array.isArray(params) ? params : params ? [params] : [];

  const filters = lookup.flatMap((p) => {
    const conditions = [];
    if ("id" in p && p.id != null) conditions.push(eq(customersSchema.id, p.id));
    if ("email" in p && p.email != null) conditions.push(eq(customersSchema.email, p.email));
    if ("phone" in p && p.phone != null) conditions.push(eq(customersSchema.phone, p.phone));
    return conditions;
  });

  if (options?.requireLookUpParams && filters.length < 1) return { data: [], has_more: false };

  const limit = params?.limit ?? 10;
  const customers = await db.query.customers.findMany({
    where: (c, { and, or }) =>
      and(
        eq(c.organizationId, organizationId),
        eq(c.environment, environment),
        filters.length ? or(...(filters as [(typeof filters)[0], ...typeof filters])) : undefined
      ),
    with: options?.withWallets ? { wallets: true } : undefined,
    limit,
  });

  return await paginate(customers, limit);
};

export const putCustomer = async (
  id: string,
  retUpdate: Partial<Customer>,
  orgId?: string,
  env?: Network,
  options?: { source?: string }
) => {
  const [
    { organizationId, environment },
    {
      data: [oldCustomer],
    },
  ] = await Promise.all([
    resolveOrgContext(orgId, env),
    retrieveCustomers({ id }, { requireLookUpParams: true }, orgId, env),
  ]);

  if (!oldCustomer) throw new AppError("Customer not found");

  const { metadata: metadataPatch, ...baseUpdate } = retUpdate;

  return withEvent(
    async () => {
      const [customer] = await db
        .update(customersSchema)
        .set({
          ...baseUpdate,
          updatedAt: new Date(),
          ...(metadataPatch !== undefined ? { metadata: patchJSON(oldCustomer.metadata, metadataPatch) } : {}),
        })
        .where(
          and(
            eq(customersSchema.id, id),
            eq(customersSchema.organizationId, organizationId),
            eq(customersSchema.environment, environment)
          )
        )
        .returning();

      if (!customer) throw new AppError("Customer not found");

      return customer;
    },
    {
      events: [
        {
          type: "customer::updated",
          map: (newCustomer) => ({
            customerId: newCustomer.id,
            data: {
              $changes: computeDiff(oldCustomer ?? {}, newCustomer, undefined, ".") ?? {},
              ...(options?.source ? { source: options.source } : {}),
            },
          }),
        },
      ],
      webhooks: {
        organizationId,
        environment,
        triggers: [
          {
            event: "customer.updated",
            map: ({ id, name, email, phone, metadata }) => {
              return {
                object: { id, name, email, phone, metadata, createdAt: new Date(), updatedAt: new Date() },
                previous_attributes: computeDiff(oldCustomer, { id, name, email, phone, metadata }) ?? {},
              };
            },
          },
        ],
      },
    }
  );
};

export const upsertCustomer = async (
  lookUpKeys: MaybeArray<CustomerLookup>,
  orgId: string,
  env: Network,
  additionalParams: { name?: string; metadata?: CustomerMetadata; image?: string }
) => {
  const lookupArray = Array.isArray(lookUpKeys) ? lookUpKeys : lookUpKeys ? [lookUpKeys] : [];
  console.log({ lookupArray });

  const existing = await retrieveCustomers(
    lookupArray.map((p) => ({
      id: "id" in p ? p.id : undefined,
      email: "email" in p ? p.email : undefined,
      phone: "phone" in p ? p.phone : undefined,
    })),
    { requireLookUpParams: true },
    orgId,
    env
  ).then(({ data: [c] }) => c);

  if (existing) return existing;

  return await postCustomers(
    [
      {
        email: lookupArray.filter((p) => "email" in p).map((p) => ("email" in p ? p.email : undefined))[0] ?? null,
        name: additionalParams.name ?? null,
        phone: lookupArray.filter((p) => "phone" in p).map((p) => ("phone" in p ? p.phone : undefined))[0] ?? null,
        metadata: additionalParams.metadata ?? null,
        image: additionalParams.image ?? null,
      },
    ],
    orgId,
    env
  ).then(([c]) => c);
};

export const deleteCustomer = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return withEvent(
    async () => {
      const [customer] = await db
        .delete(customersSchema)
        .where(
          and(
            eq(customersSchema.id, id),
            eq(customersSchema.organizationId, organizationId),
            eq(customersSchema.environment, environment)
          )
        )
        .returning();

      if (!customer) throw new AppError("Customer not found");

      await deleteEvents({ customerId: id }, organizationId, environment);

      return customer;
    },
    (customer) => {
      return {
        events: [],
        webhooks: {
          organizationId,
          environment,
          triggers: [
            {
              event: "customer.deleted",
              map: () => ({ object: { id: customer.id, status: "deleted" }, previous_attributes: customer }),
            },
          ],
        },
      };
    }
  );
};

// -- PORTAL --

export async function createCustomerPortalSession(customerId: string, orgId?: string, env?: Network) {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const portalId = generateResourceId("cus_ps", organizationId, 20);
  const portalToken = crypto.randomBytes(32).toString("base64url");

  const eventId = generateResourceId("evt", organizationId, 25);

  return withEvent(
    async () => {
      const [session] = await db
        .insert(customerPortalSessions)
        .values({
          id: portalId,
          token: portalToken,
          customerId,
          organizationId,
          environment,
          expiresAt: moment().add(24, "hours").toDate(),
        })
        .returning();

      const url = `${process.env.NEXT_PUBLIC_PORTAL_URL!}/${portalToken}`;

      return { session, url };
    },
    {
      events: [
        {
          type: "customer_portal_session::created",
          map: ({ session, url }) => ({
            id: eventId,
            customerId,
            data: { id: session.id, externalUrl: url, expiresAt: session.expiresAt },
          }),
        },
      ],
      webhooks: { organizationId, environment, triggers: [] },
    }
  );
}

export async function retrieveCustomerPortalSession(token: string) {
  const [session] = await db
    .select()
    .from(customerPortalSessions)
    .where(and(eq(customerPortalSessions.token, token), gt(customerPortalSessions.expiresAt, new Date())))
    .limit(1);

  return session ?? null;
}

export async function getPortalSessionStatus(token: string): Promise<"ok" | "expired" | "not_found"> {
  const [session] = await db
    .select({ expiresAt: customerPortalSessions.expiresAt })
    .from(customerPortalSessions)
    .where(eq(customerPortalSessions.token, token))
    .limit(1);

  if (!session) return "not_found";
  if (session.expiresAt <= new Date()) return "expired";
  return "ok";
}

export async function getCustomerPortalData(token: string) {
  const session = await retrieveCustomerPortalSession(token);
  if (!session) return null;

  const { customerId, organizationId, environment } = session;

  const [customer, org, customerSubscriptions, customerPayments, customerCredits, customerWalletList] =
    await Promise.all([
      db
        .select()
        .from(customersSchema)
        .where(eq(customersSchema.id, customerId))
        .limit(1)
        .then((r) => r[0] ?? null),

      db
        .select({ name: organizations.name, logoUrl: organizations.logoUrl, socialLinks: organizations.socialLinks })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
        .then((r) => r[0] ?? null),

      db
        .select({
          id: subscriptionsSchema.id,
          status: subscriptionsSchema.status,
          currentPeriodStart: subscriptionsSchema.currentPeriodStart,
          currentPeriodEnd: subscriptionsSchema.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionsSchema.cancelAtPeriodEnd,
          canceledAt: subscriptionsSchema.canceledAt,
          productId: subscriptionsSchema.productId,
          productName: productsSchema.name,
          productType: productsSchema.type,
          productUnit: productsSchema.unit,
          totalCredits: productsSchema.totalCredits,
          customerWalletId: subscriptionsSchema.customerWalletId,
          walletAddress: customerWallets.address,
        })
        .from(subscriptionsSchema)
        .leftJoin(productsSchema, eq(subscriptionsSchema.productId, productsSchema.id))
        .leftJoin(customerWallets, eq(subscriptionsSchema.customerWalletId, customerWallets.id))
        .where(
          and(
            eq(subscriptionsSchema.customerId, customerId),
            eq(subscriptionsSchema.organizationId, organizationId),
            eq(subscriptionsSchema.environment, environment)
          )
        )
        .orderBy(desc(subscriptionsSchema.createdAt)),

      db
        .select()
        .from(paymentsSchema)
        .where(
          and(
            eq(paymentsSchema.customerId, customerId),
            eq(paymentsSchema.organizationId, organizationId),
            eq(paymentsSchema.environment, environment),
            eq(paymentsSchema.status, "confirmed")
          )
        )
        .orderBy(desc(paymentsSchema.createdAt))
        .limit(20),

      db
        .select({
          balance: creditBalancesSchema.balance,
          consumed: creditBalancesSchema.consumed,
          granted: creditBalancesSchema.granted,
          productId: creditBalancesSchema.productId,
          productName: productsSchema.name,
          productUnit: productsSchema.unit,
          totalCredits: productsSchema.totalCredits,
        })
        .from(creditBalancesSchema)
        .leftJoin(productsSchema, eq(creditBalancesSchema.productId, productsSchema.id))
        .where(
          and(
            eq(creditBalancesSchema.customerId, customerId),
            eq(creditBalancesSchema.organizationId, organizationId),
            eq(creditBalancesSchema.environment, environment)
          )
        ),

      db
        .select()
        .from(customerWallets)
        .where(
          and(
            eq(customerWallets.customerId, customerId),
            eq(customerWallets.organizationId, organizationId),
            eq(customerWallets.environment, environment)
          )
        )
        .orderBy(desc(customerWallets.createdAt)),
    ]);

  return {
    customer,
    organization: org,
    subscriptions: customerSubscriptions,
    payments: customerPayments,
    credits: customerCredits,
    wallets: customerWalletList,
    environment,
  };
}

// -- Customer Wallet --

export const createCustomerWallet = async (
  organizationId: string,
  environment: Network,
  params: Omit<CustomerWalletSchema, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt">
) => {
  const logId = generateResourceId("wh_evt", organizationId, 52);

  return withEvent(
    async () => {
      return await db
        .insert(customerWallets)
        .values({
          ...params,
          id: generateResourceId("cwl", organizationId, 20),
          organizationId,
          environment,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning()
        .then(([w]) => w);
    },
    {
      events: [
        {
          type: "payment_method::created",
          map: (wallet) => ({
            customerId: wallet.customerId,
            data: { id: wallet.id, customerId: wallet.customerId, walletAddress: wallet.address, eventId: logId },
          }),
        },
      ],
      webhooks: {
        organizationId,
        environment,
        triggers: [
          {
            event: "payment_method.created",
            map: ({ id, address, createdAt, customerId, metadata, environment }) => ({
              object: { id, address, createdAt, customerId, metadata },
              previous_attributes: undefined,
            }),
          },
        ],
      },
    }
  );
};

export const retrieveCustomerWallets = async (
  customerId: string,
  loopUpKey?: { walletAddress?: string | null } | { id?: string | null },
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const orFilters: (SQL | undefined)[] = [];

  if (loopUpKey && "walletAddress" in loopUpKey && loopUpKey.walletAddress) {
    orFilters.push(eq(customerWallets.address, loopUpKey.walletAddress));
  }

  if (loopUpKey && "id" in loopUpKey && loopUpKey.id) {
    orFilters.push(eq(customerWallets.id, loopUpKey.id));
  }

  return await db
    .select()
    .from(customerWallets)
    .where(
      and(
        eq(customerWallets.customerId, customerId),
        eq(customerWallets.organizationId, organizationId),
        eq(customerWallets.environment, environment),
        ...orFilters.filter((f): f is SQL => !!f)
      )
    );
};

export const upsertCustomerWallet = async (
  customerId: string,
  lookUpKey: { walletAddress?: string | null } | { id?: string | null },
  orgId?: string,
  env?: Network
) => {
  console.log({ lookUpKey });
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let wallet = await retrieveCustomerWallets(customerId, lookUpKey, organizationId, environment).then(
    ([w]) => w ?? null
  );

  if (wallet) return wallet;

  if ("walletAddress" in lookUpKey && lookUpKey.walletAddress) {
    wallet = await createCustomerWallet(organizationId, environment, {
      address: lookUpKey.walletAddress!,
      customerId,
      metadata: null,
    });
  }

  console.log({ wallet });

  return wallet;
};

export const deleteCustomerWallet = async (customerId: string, walletId: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await withEvent(
    async () => {
      const activeSubscription = await db
        .select({ id: subscriptionsSchema.id })
        .from(subscriptionsSchema)
        .where(
          and(
            eq(subscriptionsSchema.customerWalletId, walletId),
            eq(subscriptionsSchema.customerId, customerId),
            eq(subscriptionsSchema.organizationId, organizationId),
            eq(subscriptionsSchema.environment, environment),
            inArray(subscriptionsSchema.status, ["active", "trialing"])
          )
        )
        .limit(1)
        .then(([s]) => s ?? null);

      if (activeSubscription) {
        throw new AppError("This wallet is linked to an active subscription and cannot be removed.");
      }

      const [deleted] = await db
        .delete(customerWallets)
        .where(
          and(
            eq(customerWallets.id, walletId),
            eq(customerWallets.customerId, customerId),
            eq(customerWallets.organizationId, organizationId),
            eq(customerWallets.environment, environment)
          )
        )
        .returning();

      if (!deleted) throw new AppError("Wallet not found");

      return deleted;
    },
    {
      events: [
        {
          type: "payment_method::deleted",
          map: (wallet) => ({ customerId, data: { id: wallet.id, customerId, walletAddress: wallet.address } }),
        },
      ],
      webhooks: {
        organizationId,
        environment,
        triggers: [
          {
            event: "payment_method.deleted",
            map: ({ id, address }) => ({ object: { id, address }, previous_attributes: undefined }),
          },
        ],
      },
    }
  );
};
