"use server";

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
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

export const postSubscriptionsBulk = async (
  params: {
    id: string;
    customerIds: string[];
    productId: string;
    period: { from: string; to: string };
    cancelAtPeriodEnd: boolean;
    metadata: Record<string, unknown> | null;
    trialDays?: number;
    priceCents: number;
  },
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return withEvent(
    async () => {
      const values = params.customerIds.map((cid) => ({
        id: params.id,
        customerId: cid,
        productId: params.productId,
        status: "active" as const,
        organizationId,
        environment,
        currentPeriodStart: new Date(params.period.from),
        currentPeriodEnd: new Date(params.period.to),
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        metadata: params.metadata,
        trialDays: params.trialDays,
      }));

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

export const retrieveSubscriptions = async (
  orgId?: string,
  env?: Network,
  params?: {
    customerId?: string;
    subscriptionId?: string;
    status?: SubscriptionStatus;
    isDue?: boolean;
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
        eq(subscriptions.environment, environment),
        ...(params?.isDue
          ? [
              or(
                and(lt(subscriptions.currentPeriodEnd, new Date()), eq(subscriptions.status, "active")),
                and(
                  eq(subscriptions.cancelAtPeriodEnd, true),
                  lt(subscriptions.currentPeriodEnd, new Date()),
                  isNull(subscriptions.canceledAt)
                )
              ),
            ]
          : [])
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
      customerWallets,
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

      const failedPaymentCount = await retrievePaymentCount(organizationId, undefined, {
        subscriptionId: subscription.id,
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
        canceledAt: new Date().toISOString(),
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
              updatedSubscription
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
                updatedSubscription
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
