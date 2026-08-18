"use server";

import { retrieveAppInstallations } from "@/actions/app";
import { resolveOrgContext } from "@/actions/organization";
import { retrieveWebhooks, triggerWebhooks } from "@/actions/webhook";
import { Event, Network, Webhook, db, events, rawDb, txContext } from "@/db";
import { deliverToApp } from "@/integrations/app-delivery";
import { generateResourceId } from "@/lib/utils";
import { EventConfig, EventEmitParams, PaginatedResult } from "@/types";
import { APP_CONFIG, AppResource, EventType } from "@stellartools/app-sdk/schema";
import { LATEST_VERSION, MaybePromise, SuggestedString, WebhookEventBase } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";
import { SQL, and, desc, eq, inArray, sql } from "drizzle-orm";
import _ from "lodash";
import { AsyncLocalStorage } from "node:async_hooks";

function buildWebhookData<T>(mapped: { object: T; previous_attributes?: Partial<T> }) {
  return {
    object: mapped.object,
    ...(mapped.previous_attributes ? { previous_attributes: mapped.previous_attributes } : {}),
  };
}

const effectBuffer = new AsyncLocalStorage<Array<() => Promise<void>>>();

export async function withEvent<T>(
  action: () => Promise<T>,
  configs?: EventConfig<T> | ((result: T) => MaybePromise<EventConfig<T> | undefined>)
): Promise<T> {
  const result = await action();

  const runSideEffects = async () => {
    try {
      const resolved = await (typeof configs === "function" ? configs(result) : configs);

      if (!resolved) return;

      const { events: eventConfigs, webhooks: webhookConfig, sideEffects } = resolved;
      const { organizationId: orgId, environment: env } = webhookConfig!;

      // 1. Identify active merchant webhooks
      const triggers = webhookConfig?.triggers
        ? Array.isArray(webhookConfig.triggers)
          ? webhookConfig.triggers
          : [webhookConfig.triggers]
        : [];

      let subscribers: Webhook[] = [];

      if (triggers.length > 0) {
        const { data } = await retrieveWebhooks(orgId, env, {
          events: triggers.map((t) => t.event),
          isDisabled: false,
          limit: 100,
        });
        subscribers = data;
      }

      // 2. DISCOVER INSTALLED APPS (Plugins)
      // Logic: If an action emits "customer::created", find apps with "read:customers" scope.
      const primaryEvent = Array.isArray(eventConfigs) ? eventConfigs[0] : eventConfigs;
      const resource = primaryEvent
        ? (Object.keys(APP_CONFIG) as AppResource[]).find((key) =>
            (APP_CONFIG[key].events as readonly string[]).includes(primaryEvent.type)
          )
        : undefined;
      const requiredScope = resource ? (`read:${resource}` as const) : null;

      const installedApps = requiredScope
        ? await retrieveAppInstallations({ status: "active", scopes: [requiredScope] }, orgId, env)
        : [];

      const deliveryLogId = subscribers.length > 0 ? generateResourceId("wh_evt", orgId, 52) : undefined;

      // 3. EMIT INTERNAL EVENTS (Dashboard Timeline)
      if (eventConfigs) {
        const eventsToEmit = (Array.isArray(eventConfigs) ? eventConfigs : [eventConfigs]).flatMap((cfg) => {
          const mapped = cfg.map(result);
          return (Array.isArray(mapped) ? mapped : [mapped]).map((m) => ({
            ...m,
            type: cfg.type,
            data: deliveryLogId ? { ...m.data, deliveryLogId } : m.data,
          }));
        });
        await emitEvents(eventsToEmit, orgId, env);
      }

      // 4. DISPATCH WEBHOOKS (To Merchant + To Installed Apps)
      const deliveries: Promise<any>[] = [];

      // A. Standard Merchant Webhooks
      if (subscribers.length > 0) {
        triggers.forEach((trigger) => {
          const targets = subscribers.filter((s) => s.events.includes(trigger.event));
          if (targets.length === 0) return;

          const mapped = trigger.map(result);
          const envelope: WebhookEventBase<string, any> = {
            id: deliveryLogId!,
            type: trigger.event,
            created: new Date().toISOString(),
            livemode: env === "mainnet",
            api_version: LATEST_VERSION,
            data: buildWebhookData(mapped),
          };

          deliveries.push(triggerWebhooks(targets, trigger.event, [envelope], deliveryLogId!));
        });
      }

      if (sideEffects && sideEffects.length > 0) {
        sideEffects.forEach((effect) => {
          if (typeof waitUntil === "function") waitUntil(effect());
          else effect().catch((e) => console.error("[SideEffect Error]", e));
        });
      }

      // B. Plugin/App Webhooks (Partner servers)
      if (installedApps.length > 0 && triggers.length > 0) {
        triggers.forEach((trigger) => {
          installedApps.forEach(({ app, app_installation }) => {
            const appLogId = generateResourceId("wh_evt", orgId, 52);

            const mapped = trigger.map(result);
            const envelope: WebhookEventBase<string, any> = {
              id: appLogId,
              type: trigger.event,
              created: new Date().toISOString(),
              livemode: env === "mainnet",
              api_version: LATEST_VERSION,
              data: buildWebhookData(mapped),
            };

            deliveries.push(
              deliverToApp(
                app,
                app_installation.id,
                { ...envelope, organizationId: orgId, environment: env },
                appLogId,
                app_installation.settings
              )
            );
          });
        });
      }

      await Promise.allSettled(deliveries);
    } catch (err) {
      console.error(`[Side-Effect Critical Failure]:`, err);
    }
  };

  const buffer = effectBuffer.getStore();
  if (buffer) buffer.push(runSideEffects);
  else if (typeof waitUntil === "function") waitUntil(runSideEffects());
  else runSideEffects();

  return result;
}

export const emitEvents = async (params: Array<EventEmitParams>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .insert(events)
    .values(
      params.map((p) => ({ ...p, id: generateResourceId("evt", organizationId, 25), organizationId, environment }))
    )
    .returning()
    .then(([event]) => event);
};

type NarrowedEvent<T extends EventType> = Event & { type: T };

type NarrowedEvents<T extends readonly EventType[]> = Array<NarrowedEvent<T[number]>>;

export const retrieveEvents = async <T extends readonly EventType[]>(
  filters: {
    customerId?: string;
    merchantId?: SuggestedString<"current">;
    subscriptionId?: string;
    payoutId?: string;
  },
  eventTypes?: T,
  orgId?: string,
  env?: Network
): Promise<NarrowedEvents<T>> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let whereClause = [];

  if (filters?.customerId) {
    whereClause.push(eq(events.customerId, filters.customerId));
  }

  if (filters.merchantId == "current") {
    whereClause.push(eq(events.merchantId, organizationId));
  } else if (filters.merchantId) {
    whereClause.push(eq(events.merchantId, filters.merchantId));
  }
  if (filters.subscriptionId) {
    whereClause.push(eq(events.subscriptionId, filters.subscriptionId));
  }
  if (filters.payoutId) {
    whereClause.push(sql`${events.data}->>'payoutId' = ${filters.payoutId}`);
  }
  if (eventTypes) {
    whereClause.push(inArray(events.type, eventTypes));
  }

  return await db
    .select()
    .from(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.environment, environment), ...whereClause))
    .orderBy(desc(events.createdAt))
    .then((events) => events.map((e) => ({ ...e, type: e.type as T[number] })));
};

export const deleteEvents = async (
  filters: { customerId?: string; merchantId?: string; subscriptionId?: string },
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let whereClause: Array<SQL<unknown>> = [];

  if (filters?.customerId) {
    whereClause.push(eq(events.customerId, filters.customerId));
  }

  if (filters.merchantId == "current") {
    whereClause.push(eq(events.merchantId, organizationId));
  } else if (filters.merchantId) {
    whereClause.push(eq(events.merchantId, filters.merchantId));
  }
  if (filters.subscriptionId) {
    whereClause.push(eq(events.subscriptionId, filters.subscriptionId));
  }

  return await db
    .delete(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.environment, environment), ...whereClause));
};

export async function runAtomic<T>(fn: () => Promise<T>): Promise<T> {
  const sideEffects: Array<() => Promise<void>> = [];

  const result = await effectBuffer.run(sideEffects, async () => {
    return await rawDb.transaction(async (tx) => {
      return await txContext.run(tx, async () => {
        return await fn();
      });
    });
  });

  sideEffects.forEach((effect) => {
    if (typeof waitUntil === "function") waitUntil(effect());
    else effect().catch((e) => console.error("[Side-Effect Error]", e));
  });

  return result;
}

export const paginate = async <T>(data: T[], limit: number): Promise<PaginatedResult<T>> => {
  const has_more = data.length > limit;
  return {
    data: has_more ? data.slice(0, limit) : data,
    has_more,
  };
};

// `starting_after` is an offset supplied by API clients; never let a bad value reach SQL as NaN
export const parseOffset = async (startingAfter?: string | null): Promise<number> => {
  if (!startingAfter) return 0;
  const offset = Number.parseInt(startingAfter, 10);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
};
