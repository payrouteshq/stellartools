"use server";

import { upsertCustomerWallet } from "@/actions/customers";
import { paginate, withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { retrievePaymentCount } from "@/actions/payment";
import { SubscriptionStatus } from "@/constant/schema.client";
import {
  Network,
  ResolvedSubscription,
  Subscription,
  customerWallets,
  customers,
  db,
  products,
  subscriptions,
} from "@/db";
import { AppError } from "@/lib/action-handler";
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
  const status = params.status ?? (trialDays > 0 ? "trialing" : "active");

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
    .limit(limit)
    .orderBy(desc(subscriptions.createdAt))
    .offset(params?.starting_after ? parseInt(params.starting_after) : 0);

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

      if (!record) throw new AppError("Subscription not found");

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
