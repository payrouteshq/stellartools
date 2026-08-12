"use server";

import { retrieveSupportedAssets } from "@/actions/asset";
import { upsertCustomerWallet } from "@/actions/customers";
import { paginate, parseOffset, runAtomic, withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { postPayment, retrievePaymentCount, retrievePayments } from "@/actions/payment";
import { STELLAR_PRECISION, subscriptionPeriodMs } from "@/constant";
import { SubscriptionStatus } from "@/constant/schema.client";
import {
  Network,
  ResolvedSubscription,
  Subscription,
  customerWallets,
  customers,
  db,
  organizations,
  payments,
  products,
  subscriptions,
} from "@/db";
import { chargeSubscription as soroban$chargeSubscription } from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { initialSubscriptionStatus } from "@/lib/subscription";
import { computeDiff, generateResourceId } from "@/lib/utils";
import { toSnakeCase } from "@/lib/utils";
import { ApiListParams, EventTrigger, PaginatedResult, WebhookTrigger } from "@/types";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

export const postSubscriptionsBulk = async (
  params: {
    id: string;
    customerId: string;
    productId: string;
    period: { from: string; to: string };
    cancelAtPeriodEnd: boolean;
    metadata: Record<string, unknown> | null;
    trialDays?: number;
    status?: SubscriptionStatus;
    customerWalletAddress?: string;
  },
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);
  const trialDays = params.trialDays ?? 0;
  const status = initialSubscriptionStatus(trialDays, params.status);

  return withEvent(
    async () => {
      let customerWalletId: string | null = null;

      if (params.customerWalletAddress && params.customerId) {
        customerWalletId = (
          await upsertCustomerWallet(
            params.customerId,
            { walletAddress: params.customerWalletAddress },
            organizationId,
            environment
          )
        ).id;
      }

      const values = {
        id: params.id,
        customerId: params.customerId,
        productId: params.productId,
        status,
        organizationId,
        environment,
        customerWalletId: customerWalletId,
        currentPeriodStart: new Date(params.period.from),
        currentPeriodEnd: new Date(params.period.to),
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        metadata: params.metadata,
        trialDays: trialDays > 0 ? trialDays : 0,
      };

      return await db.insert(subscriptions).values(values).returning();
    },
    (subscriptions) => {
      const data = subscriptions.map(
        ({
          id,
          customerId,
          productId,
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          metadata,
          trialDays,
        }) => ({
          id,
          customerId,
          productId,
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          metadata,
          trialDays,
        })
      );

      return {
        events: [
          {
            type: "subscription::created",
            map: () => data.map((s) => ({ customerId: s.customerId, subscriptionId: s.id, data: s })),
          },
        ],
        webhooks: {
          organizationId,
          environment,
          triggers: [
            ...data.map((s) => ({
              event: "subscription.created",
              map: () => ({
                object: { ...s, canceledAt: null, updatedAt: new Date() },
                previous_attributes: undefined,
              }),
            })),
          ],
        },
      };
    }
  );
};

export const retrieveDueSubscriptions = async (options?: {
  withCustomer?: boolean;
  withProduct?: boolean;
  withCustomerWallets?: boolean;
  limit?: number;
}): Promise<ResolvedSubscription[]> => {
  const limit = options?.limit ?? 100;

  const rows = await db
    .select({
      subscription: subscriptions,
      ...(options?.withCustomer && { customer: customers }),
      ...(options?.withProduct && { product: products }),
      ...(options?.withCustomerWallets && { customerWallets: customerWallets }),
    })
    .from(subscriptions)
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .where(
      or(
        and(
          lt(subscriptions.currentPeriodEnd, new Date()),
          inArray(subscriptions.status, ["active", "past_due"]),
          eq(subscriptions.cancelAtPeriodEnd, false)
        ),
        and(
          eq(subscriptions.status, "trialing"),
          gt(subscriptions.trialDays, 0),
          lt(sql`${subscriptions.createdAt} + (${subscriptions.trialDays} * interval '1 day')`, new Date()),
          eq(subscriptions.cancelAtPeriodEnd, false)
        ),
        and(
          eq(subscriptions.cancelAtPeriodEnd, true),
          lt(subscriptions.currentPeriodEnd, new Date()),
          isNull(subscriptions.canceledAt)
        )
      )
    )
    .limit(limit)
    .orderBy(desc(subscriptions.currentPeriodEnd));

  return rows.map(({ customer, product, customerWallets, subscription }) => ({
    ...subscription,
    customer,
    product,
    customerWallet: customerWallets ?? null,
  }));
};

export const retrieveSubscriptions = async (
  orgId?: string,
  env?: Network,
  params?: {
    customerId?: string;
    subscriptionId?: string;
    status?: SubscriptionStatus;
  } & ApiListParams,
  options?: { withCustomer?: boolean; withProduct?: boolean; withCustomerWallets?: boolean }
): Promise<PaginatedResult<ResolvedSubscription>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const limit = params?.limit ?? 10;
  const offset = await parseOffset(params?.starting_after);

  const rows = await db
    .select({
      subscription: subscriptions,
      ...(options?.withCustomer && { customer: customers }),
      ...(options?.withProduct && { product: products }),
      ...(options?.withCustomerWallets && { customerWallets: customerWallets }),
    })
    .from(subscriptions)
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .where(
      and(
        params?.subscriptionId ? eq(subscriptions.id, params.subscriptionId) : undefined,
        params?.customerId ? eq(subscriptions.customerId, params.customerId) : undefined,
        params?.status ? eq(subscriptions.status, params.status) : undefined,
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment)
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit + 1)
    .offset(offset);

  return await paginate(
    rows.map(({ customer, product, customerWallets, subscription }) => ({
      ...subscription,
      customer,
      product,
      customerWallet: customerWallets ?? null,
    })),
    limit
  );
};

export const putSubscription = async (id: string, retUpdate: Partial<Subscription>, orgId?: string, env?: Network) => {
  const [
    { organizationId, environment },
    {
      data: [oldSubscription],
    },
  ] = await Promise.all([resolveOrgContext(orgId, env), retrieveSubscriptions(orgId, env, { subscriptionId: id })]);

  if (!oldSubscription) throw new AppError("NOT_FOUND", "Subscription not found");

  return withEvent(
    async () => {
      const [record] = await db
        .update(subscriptions)
        .set({ ...retUpdate, updatedAt: new Date() })
        .where(
          and(
            eq(subscriptions.id, id),
            eq(subscriptions.organizationId, organizationId),
            eq(subscriptions.environment, environment)
          )
        )
        .returning();

      if (!record) throw new AppError("INTERNAL_ERROR", "Failed to update subscription");

      return record;
    },
    async (subscription) => {
      let events: EventTrigger<typeof subscription>[] = [];
      let webhookTriggers: WebhookTrigger<typeof subscription>[] = [];
      const logId = generateResourceId("wh_evt", organizationId, 52);

      const failedPaymentCount = await retrievePaymentCount(organizationId, environment, {
        subscriptionIds: [subscription.id],
        status: "failed",
      });

      const updatedSubscription = {
        id: subscription.id,
        customerId: subscription.customerId,
        productId: subscription.productId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
        canceledAt: subscription.canceledAt?.toISOString() ?? null,
        pausedAt: subscription.pausedAt?.toISOString() ?? null,
        createdAt: subscription.createdAt?.toISOString(),
        failedPaymentCount,
        invoiceUrl: subscription.invoiceToken
          ? `${process.env.NEXT_PUBLIC_INVOICE_URL}/subscription/${subscription.invoiceToken}`
          : null,
        updatedAt: new Date().toISOString(),
        metadata: subscription.metadata,
        trialDays: subscription.trialDays,
      };

      if (subscription.status === "canceled") {
        webhookTriggers.push({
          event: "subscription.canceled",
          map: () => ({
            object: toSnakeCase(updatedSubscription),
            previous_attributes: computeDiff(
              {
                ...oldSubscription,
                canceledAt: oldSubscription.canceledAt?.toISOString(),
                createdAt: oldSubscription.createdAt?.toISOString(),
                currentPeriodStart: oldSubscription.currentPeriodStart.toISOString(),
                currentPeriodEnd: oldSubscription.currentPeriodEnd.toISOString(),
                pausedAt: oldSubscription.pausedAt?.toISOString() ?? null,
                updatedAt: oldSubscription.updatedAt?.toISOString(),
              },
              { ...updatedSubscription, canceledAt: updatedSubscription.canceledAt ?? undefined }
            )?.previous_attributes,
          }),
        });

        events.push({
          type: "subscription::canceled",
          map: (subscription) => ({
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            data: { $changes: computeDiff(oldSubscription, subscription) ?? {}, eventId: logId },
          }),
        });
      } else {
        webhookTriggers.push({
          event: "subscription.updated",
          map: () => ({
            object: toSnakeCase(updatedSubscription),
            previous_attributes:
              computeDiff(
                {
                  ...oldSubscription,
                  canceledAt: oldSubscription.canceledAt?.toISOString(),
                  createdAt: oldSubscription.createdAt?.toISOString(),
                  currentPeriodStart: oldSubscription.currentPeriodStart.toISOString(),
                  currentPeriodEnd: oldSubscription.currentPeriodEnd.toISOString(),
                  pausedAt: oldSubscription.pausedAt?.toISOString() ?? null,
                  updatedAt: oldSubscription.updatedAt?.toISOString(),
                },
                { ...updatedSubscription, canceledAt: updatedSubscription.canceledAt ?? undefined }
              )?.previous_attributes ?? {},
          }),
        });

        events.push({
          type: "subscription::updated",
          map: (subscription) => ({
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            data: { $changes: computeDiff(oldSubscription, subscription) ?? {}, eventId: logId },
          }),
        });
      }

      return {
        events,
        webhooks: { organizationId, environment, triggers: webhookTriggers },
      };
    }
  );
};

export const deleteSubscription = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.id, id),
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment)
      )
    )
    .returning();

  return null;
};

// ------------- Subscription Invoice -------------

export const retrieveSubscriptionInvoice = async (token: string) => {
  const [row] = await db
    .select({
      subscription: subscriptions,
      product: products,
      customer: customers,
      customerWallet: customerWallets,
      organization: organizations,
    })
    .from(subscriptions)
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
    .where(eq(subscriptions.invoiceToken, token))
    .limit(1);

  if (!row?.product || !row.organization) return null;

  const [lastPayment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.subscriptionId, row.subscription.id), eq(payments.status, "confirmed")))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return {
    token,
    subscriptionId: row.subscription.id,
    status: row.subscription.status,
    amountCents: row.product.priceCents,
    currencyCode: row.product.currencyCode,
    productName: row.product.name,
    environment: row.subscription.environment,
    merchant: {
      name: row.organization.name,
      logoUrl: row.organization.logoUrl,
      supportEmail: row.organization.supportEmail,
    },
    customer: row.customer ? { name: row.customer.name, email: row.customer.email } : null,
    lastPayment: lastPayment
      ? {
          id: lastPayment.id,
          createdAt: lastPayment.createdAt,
          transactionHash: lastPayment.transactionHash,
          cryptoAmount: lastPayment.cryptoAmount,
          selectedAssetCode: lastPayment.selectedAssetCode,
        }
      : null,
  };
};

export type PublicSubscriptionInvoice = Awaited<ReturnType<typeof retrieveSubscriptionInvoice>>;

export const paySubscriptionInvoice = async (token: string, connectedWalletAddress: string) => {
  const invoice = await retrieveSubscriptionInvoice(token);
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found");
  if (invoice.status !== "overdue") return { paid: true };

  const [sub] = await db
    .select({ subscription: subscriptions, product: products, wallet: customerWallets })
    .from(subscriptions)
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .where(eq(subscriptions.invoiceToken, token))
    .limit(1);

  if (!sub?.product || !sub.wallet) throw new AppError("NOT_FOUND", "Subscription payment details not found");
  const wallet = sub.wallet;
  if (wallet.address !== connectedWalletAddress) {
    throw new AppError("VALIDATION_ERROR", "Connect the wallet used for this subscription to pay the invoice");
  }

  const record = sub.subscription;
  const { data: priorPayments } = await retrievePayments(record.organizationId, record.environment, {
    subscriptionId: record.id,
    limit: 1,
  });
  const prior = priorPayments[0];
  if (!prior) throw new AppError("NOT_FOUND", "No previous subscription payment found");

  const [asset] = await retrieveSupportedAssets({ code: prior.selectedAssetCode }, record.environment);
  const { cryptoAmount: chargeDisplay, amountRaw } = await Money.calculateSubscriptionAmount({
    priceCents: sub.product.priceCents,
    currencyCode: sub.product.currencyCode,
    assetMetadata: asset?.metadata ?? {},
  });
  const billingMs = subscriptionPeriodMs(sub.product.recurringPeriod, sub.product.customDurationMs);
  if (!billingMs) throw new AppError("VALIDATION_ERROR", "Invalid subscription billing period");

  const charge = await soroban$chargeSubscription(record.environment, wallet.address, record.productId, amountRaw);
  if (charge.isErr()) throw new AppError("STELLAR_ERROR", charge.error.message);

  const payEvent = charge.value.events.find((event) => event.topic.includes("sub_pay"));
  const cryptoAmount = payEvent
    ? (Number(BigInt(String(payEvent.data.amount ?? 0))) / 10 ** STELLAR_PRECISION).toFixed(STELLAR_PRECISION)
    : chargeDisplay;
  const nextPeriod = payEvent?.data.periodEnd
    ? new Date(Number(payEvent.data.periodEnd) * 1000)
    : new Date(Date.now() + billingMs);

  await runAtomic(async () => {
    await putSubscription(
      record.id,
      { status: "active", currentPeriodStart: new Date(), currentPeriodEnd: nextPeriod },
      record.organizationId,
      record.environment
    );
    await postPayment(
      {
        subscriptionId: record.id,
        checkoutId: null,
        productId: record.productId,
        customerId: record.customerId,
        amountCents: sub.product!.priceCents,
        currencyCode: sub.product!.currencyCode,
        cryptoAmount,
        selectedAssetCode: prior.selectedAssetCode,
        selectedAssetIssuer: prior.selectedAssetIssuer,
        transactionHash: charge.value.hash,
        status: "confirmed",
        metadata: null,
        failureReason: null,
      },
      record.organizationId,
      record.environment,
      { customerWalletAddress: wallet.address }
    );
  });

  return { paid: true };
};
