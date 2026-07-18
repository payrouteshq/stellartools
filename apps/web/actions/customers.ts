"use server";

import { deleteEvents, paginate, parseOffset, withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import {
  Customer,
  CustomerMetadata,
  Network,
  ResolvedCustomer,
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
import { deleteCookies, getCookie, setCookies } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { uploadFiles } from "@/integrations/file-upload";
import { AppError } from "@/lib/action-handler";
import { computeDiff, generateResourceId } from "@/lib/utils";
import { ApiListParams, PaginatedResult } from "@/types";
import { MaybeArray } from "@stellartools/core";
import crypto from "crypto";
import { SQL, and, desc, eq, gt, inArray, sql } from "drizzle-orm";
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
        .onConflictDoUpdate({
          target: [customersSchema.organizationId, customersSchema.email],
          set: {
            name: sql`coalesce(excluded.name, ${customersSchema.name})`,
            phone: sql`coalesce(excluded.phone, ${customersSchema.phone})`,
            image: sql`coalesce(excluded.image, ${customersSchema.image})`,
            metadata: sql`coalesce(excluded.metadata, ${customersSchema.metadata})`,
            updatedAt: new Date(),
          },
        })
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

  const lookupGroups = Array.isArray(params) ? params : params ? [params] : [];

  const filters = lookupGroups
    .map((group) => {
      const groupConditions = [];
      if ("id" in group && group.id != null) groupConditions.push(eq(customersSchema.id, group.id));
      if ("email" in group && group.email != null) groupConditions.push(eq(customersSchema.email, group.email));
      if ("phone" in group && group.phone != null) groupConditions.push(eq(customersSchema.phone, group.phone));

      return groupConditions.length > 0 ? and(...groupConditions) : null;
    })
    .filter((f): f is SQL => f !== null);

  if (options?.requireLookUpParams && filters.length < 1) return { data: [], has_more: false };

  const limit = params?.limit ?? 10;
  const offset = await parseOffset(params?.starting_after);

  const customers = await db.query.customers.findMany({
    where: (c, { and, or }) =>
      and(
        eq(c.organizationId, organizationId),
        eq(c.environment, environment),
        filters.length > 0 ? or(...filters) : undefined
      ),
    with: options?.withWallets ? { wallets: true } : undefined,
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    limit: limit + 1,
    offset,
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

  if (!oldCustomer) throw new AppError("NOT_FOUND", "Customer not found");

  const { metadata: metadataPatch, ...baseUpdate } = retUpdate;

  return withEvent(
    async () => {
      const [customer] = await db
        .insert(customersSchema)
        .values({
          ...baseUpdate,
          id,
          organizationId,
          environment,
          updatedAt: new Date(),
          metadata: metadataPatch ? { ...(oldCustomer.metadata ?? {}), ...metadataPatch } : oldCustomer.metadata,
        })
        .onConflictDoUpdate({
          target: [customersSchema.id],
          set: {
            ...baseUpdate,
            updatedAt: new Date(),
            metadata: metadataPatch ? sql`"customer"."metadata" || ${metadataPatch}` : undefined,
          },
        })
        .returning();

      return customer ?? oldCustomer;
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

  const id = lookupArray.find((p): p is { id: string } => "id" in p && !!p.id)?.id;
  const email = lookupArray.find((p): p is { email: string } => "email" in p && !!p.email)?.email;
  const phone = lookupArray.find((p): p is { phone: string } => "phone" in p && !!p.phone)?.phone;

  const findExisting = async (lookup: CustomerLookup) =>
    retrieveCustomers(lookup, { requireLookUpParams: true }, orgId, env).then(({ data: [c] }) => c);

  if (id) {
    const existing = await findExisting({ id });
    if (existing) return existing;
  }
  if (email) {
    const existing = await findExisting({ email });
    if (existing) return existing;
  }
  if (phone) {
    const existing = await findExisting({ phone });
    if (existing) return existing;
  }

  return await postCustomers(
    [
      {
        email: email ?? null,
        name: additionalParams.name ?? null,
        phone: phone ?? null,
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

      if (!customer) throw new AppError("NOT_FOUND", "Customer not found");

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

  const [customer, org, customerSubscriptions, customerPayments, customerWalletList] = await Promise.all([
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
    wallets: customerWalletList,
    environment,
  };
}

export async function sendPortalOtp(token: string): Promise<{ maskedEmail: string } | { error: string }> {
  const session = await retrieveCustomerPortalSession(token);
  if (!session) return { error: "Invalid or expired portal session." };

  const customer = await db
    .select({ email: customersSchema.email })
    .from(customersSchema)
    .where(eq(customersSchema.id, session.customerId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!customer?.email) return { error: "No email address on file. Contact the merchant." };

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hash = crypto
    .createHash("sha256")
    .update(otp + token)
    .digest("hex");
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await setCookies([{ key: `portal_otp_${token.slice(0, 20)}`, value: `${hash}:${expiresAt}`, maxAge: 600 }]);

  await sendEmail(
    customer.email,
    "Your portal verification code",
    `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  );

  const [local, domain] = customer.email.split("@");
  const maskedEmail = `${local.slice(0, 2)}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;

  return { maskedEmail };
}

export async function verifyPortalOtp(token: string, code: string): Promise<{ success: true } | { error: string }> {
  const cookieKey = `portal_otp_${token.slice(0, 20)}`;

  const cookieValue = await getCookie(cookieKey);

  if (!cookieValue) return { error: "No pending verification. Please request a new code." };

  const [storedHash, expiresAtStr] = cookieValue.split(":");
  if (!storedHash || !expiresAtStr) return { error: "Invalid verification state." };

  if (Date.now() > parseInt(expiresAtStr)) {
    await deleteCookies([cookieKey]);
    return { error: "Code expired. Please request a new one." };
  }

  const submittedHash = crypto
    .createHash("sha256")
    .update(code + token)
    .digest("hex");
  if (submittedHash !== storedHash) return { error: "Invalid code. Please try again." };

  const authValue = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(token).digest("hex");

  await deleteCookies([cookieKey]);
  await setCookies([{ key: `portal_auth_${token.slice(0, 20)}`, value: authValue, maxAge: 24 * 60 * 60 }]);

  return { success: true };
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
        throw new AppError(
          "VALIDATION_ERROR",
          "This wallet is linked to an active subscription and cannot be removed."
        );
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

      if (!deleted) throw new AppError("NOT_FOUND", "Wallet not found");

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
