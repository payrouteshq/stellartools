"use server";

import { paginate, withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { retrievePaymentCount } from "@/actions/payment";
import { SubscriptionStatus } from "@/constant/schema.client";
import { Network, Subscription, assets, customerWallets, customers, db, products, subscriptions } from "@/db";
import { computeDiff, generateResourceId } from "@/lib/utils";
import { toSnakeCase } from "@/lib/utils";
import { ApiListParams, EventTrigger, PaginatedResult, WebhookTrigger } from "@/types";
import { OverrideProps, Prettify } from "@stellartools/core";
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

export const retrieveSubscription = async (
  id: string,
  orgId?: string,
  env?: Network,
  params?: ApiListParams
): Promise<PaginatedResult<Subscription>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);
  const limit = params?.limit ?? 10;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.id, id),
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment)
      )
    )
    .limit(limit)
    .offset(params?.starting_after ? parseInt(params.starting_after) : 0);

  if (!subscription) return { data: [], has_more: false };

  return await paginate([subscription], limit);
};

type SubscriptionRow<S extends SubscriptionStatus> = {
  subscription: OverrideProps<Subscription, { status: S }>;
  customer: { name: string | null; email: string | null };
  product: { name: string; priceAmount: number };
};

export const retrieveSubscriptions = async <S extends SubscriptionStatus = SubscriptionStatus>(
  orgId?: string,
  env?: Network,
  filters?: { customerId?: string; status?: S },
  params?: ApiListParams
): Promise<Prettify<PaginatedResult<SubscriptionRow<S>>>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const limit = params?.limit ?? 10;

  const rows = await db
    .select({
      subscription: subscriptions,
      customer: { name: customers.name, email: customers.email },
      product: { name: products.name, priceAmount: products.priceAmount },
    })
    .from(subscriptions)
    .innerJoin(customers, eq(subscriptions.customerId, customers.id))
    .innerJoin(products, eq(subscriptions.productId, products.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment),
        filters?.customerId ? eq(subscriptions.customerId, filters.customerId) : undefined,
        filters?.status ? eq(subscriptions.status, filters.status) : undefined
      )
    )
    .orderBy(desc(subscriptions.createdAt));

  return await paginate(rows as unknown as SubscriptionRow<S>[], limit);
};

export const listSubscriptions = async (
  customerId: string,
  orgId?: string,
  env?: Network,
  params?: ApiListParams
): Promise<PaginatedResult<Subscription>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const limit = params?.limit ?? 10;

  const subscriptionList = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.customerId, customerId),
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.environment, environment)
      )
    )
    .limit(limit)
    .offset(params?.starting_after ? parseInt(params.starting_after) : 0);

  return await paginate(subscriptionList, limit);
};

export const putSubscription = async (id: string, retUpdate: Partial<Subscription>, orgId?: string, env?: Network) => {
  const [
    { organizationId, environment },
    {
      data: [oldSubscription],
    },
  ] = await Promise.all([resolveOrgContext(orgId, env), retrieveSubscription(id)]);

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

      if (!record) throw new Error("Subscription not found");

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

export const retrieveDueSubscriptions = async () => {
  const results = await db
    .select({
      subscription: {
        id: subscriptions.id,
        productId: subscriptions.productId,
        organizationId: subscriptions.organizationId,
        environment: subscriptions.environment,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        assetId: products.assetId,
      },
      customer: { id: customers.id },
      asset: { code: assets.code, issuer: assets.issuer, metadata: assets.metadata },
      wallet: customerWallets,
    })
    .from(subscriptions)
    .where(
      or(
        and(lt(subscriptions.currentPeriodEnd, new Date()), eq(subscriptions.status, "active")),
        and(
          eq(subscriptions.cancelAtPeriodEnd, true),
          lt(subscriptions.currentPeriodEnd, new Date()),
          isNull(subscriptions.canceledAt)
        )
      )
    )
    .innerJoin(customers, eq(subscriptions.customerId, customers.id))
    .innerJoin(products, eq(subscriptions.productId, products.id))
    .innerJoin(assets, eq(products.assetId, assets.id))
    .innerJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .orderBy(desc(subscriptions.currentPeriodEnd));

  return results;
};
