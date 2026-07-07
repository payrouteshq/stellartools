"use server";

import { retrieveAppInstallations } from "@/actions/app";
import { resolveOrgContext } from "@/actions/organization";
import { DeliveryLog, Network, Webhook, db, deliveryLogs, webhooks } from "@/db";
import { deliverToApp } from "@/integrations/app-delivery";
import { deliverWebhook } from "@/integrations/webhook-delivery";
import { AppError, safeAction } from "@/lib/action-handler";
import { toSnakeCase } from "@/lib/utils";
import { generateResourceId } from "@/lib/utils";
import { WebhookEventBase, WebhookEventType } from "@stellartools/core";
import { SQL, and, desc, eq, isNull, sql } from "drizzle-orm";

export const postWebhook = async (
  orgId?: string,
  env?: Network,
  data?: Omit<Webhook, "id" | "organizationId" | "environment">
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [webhook] = await db
    .insert(webhooks)
    .values({
      ...data,
      id: generateResourceId("wh", organizationId, 20),
      isDisabled: false,
      organizationId,
      environment,
    } as Webhook)
    .returning();

  if (!webhook) throw new AppError("Failed to create webhook");

  return webhook as Webhook;
};

export const getWebhooksWithAnalytics = async (orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const result = await db
    .select({
      id: webhooks.id,
      organizationId: webhooks.organizationId,
      url: webhooks.url,
      secret: webhooks.secret,
      events: webhooks.events,
      name: webhooks.name,
      description: webhooks.description,
      isDisabled: webhooks.isDisabled,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
      environment: webhooks.environment,
      logsCount: sql<number>`cast(count(${deliveryLogs.id}) as integer)`.as("logs_count"),
      errorCount: sql<number>`cast(count(${deliveryLogs.id}) filter (where ${deliveryLogs.statusCode} >= 400) as integer)`,
      hourlyActivity: sql<Array<{ h: string; c: number }>>`
        (SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT 
            to_char(date_trunc('hour', ${deliveryLogs.createdAt}), 'YYYY-MM-DD"T"HH24') as h, 
            count(*)::int as c
          FROM ${deliveryLogs}
          WHERE ${deliveryLogs.webhookId} = ${webhooks.id} 
            AND ${deliveryLogs.createdAt} >= NOW() - INTERVAL '24 hours'
          GROUP BY 1 ORDER BY 1
        ) item)
      `,
      responseTime: sql<number[]>`
        array_agg(${deliveryLogs.responseTime} order by ${deliveryLogs.createdAt} desc) 
        filter (where ${deliveryLogs.responseTime} is not null)
      `,
    })
    .from(webhooks)
    .leftJoin(deliveryLogs, eq(deliveryLogs.webhookId, webhooks.id))
    .where(and(eq(webhooks.organizationId, organizationId), eq(webhooks.environment, environment)))
    .groupBy(webhooks.id);

  return result.map((webhook) => ({
    ...webhook,
    errorRate: webhook.logsCount > 0 ? Math.round((webhook.errorCount / webhook.logsCount) * 100) : 0,
    responseTimeHistory: (webhook.responseTime ?? []).slice(0, 50).reverse(),
  }));
};

export const retrieveWebhooks = async (
  orgId?: string,
  env?: Network,
  params?: { id?: string; isDisabled?: boolean; events?: WebhookEventType[] }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let webhooksResult = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.environment, environment),
        ...(params?.id ? [eq(webhooks.id, params.id)] : []),
        ...(params?.isDisabled !== undefined ? [eq(webhooks.isDisabled, params.isDisabled)] : [])
      )
    );

  if (params?.events) {
    webhooksResult = webhooksResult.filter((w) => w.events.some((e) => params?.events?.includes(e)));
  }

  if (!webhooksResult.length) return [];

  return webhooksResult;
};

export const putWebhook = async (id: string, data: Partial<Webhook>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [webhook] = await db
    .update(webhooks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId), eq(webhooks.environment, environment)))
    .returning();

  if (!webhook) throw new AppError("Failed to update webhook");

  return webhook;
};

export const deleteWebhook = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId), eq(webhooks.environment, environment)))
    .returning();

  return null;
};

export const postDeliveryLog = async (
  filter: { webhookId?: string } | { appInstallationId?: string },
  params: Omit<DeliveryLog, "organizationId" | "environment" | "webhookId">,
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [deliveryLog] = await db
    .insert(deliveryLogs)
    .values({
      ...params,
      ...("webhookId" in filter && { webhookId: filter.webhookId }),
      ...("appInstallationId" in filter && { appInstallationId: filter.appInstallationId }),
      organizationId,
      environment,
    } as DeliveryLog)
    .returning();

  if (!deliveryLog) throw new AppError("Failed to create delivery log");

  return deliveryLog;
};

export const retrieveDeliveryLogs = async (
  webhookId: string,
  orgId?: string,
  env?: Network,
  params?: { appInstallationId?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const appInstallationId = params?.appInstallationId ?? undefined;

  let whereClause: SQL<unknown>[] = [];

  if (appInstallationId) {
    whereClause.push(eq(deliveryLogs.appInstallationId, appInstallationId));
  } else {
    whereClause.push(isNull(deliveryLogs.appInstallationId) as SQL<unknown>);
    whereClause.push(eq(deliveryLogs.organizationId, organizationId));
  }

  const deliveryLogsResult = await db
    .select()
    .from(deliveryLogs)
    .where(and(eq(deliveryLogs.webhookId, webhookId), eq(deliveryLogs.environment, environment), ...whereClause))
    .orderBy(desc(deliveryLogs.createdAt));

  return deliveryLogsResult;
};

export const retrieveDeliveryLog = async (
  id: string,
  orgId?: string,
  env?: Network,
  params?: { appInstallationId?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let whereClause: SQL<unknown>[] = [];

  const appInstallationId = params?.appInstallationId ?? undefined;

  if (appInstallationId) {
    whereClause.push(eq(deliveryLogs.appInstallationId, appInstallationId));
  } else {
    whereClause.push(isNull(deliveryLogs.appInstallationId) as SQL<unknown>);
    whereClause.push(eq(deliveryLogs.organizationId, organizationId));
  }

  const [deliveryLog] = await db
    .select()
    .from(deliveryLogs)
    .where(and(eq(deliveryLogs.id, id), eq(deliveryLogs.environment, environment), ...whereClause));

  return deliveryLog;
};

export const putDeliveryLog = async (id: string, data: Partial<DeliveryLog>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [deliveryLog] = await db
    .update(deliveryLogs)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(deliveryLogs.id, id),
        eq(deliveryLogs.organizationId, organizationId),
        eq(deliveryLogs.environment, environment)
      )
    )
    .returning();

  if (!deliveryLog) throw new AppError("Failed to update delivery log");

  return deliveryLog;
};

export const deleteDeliveryLog = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  await db
    .delete(deliveryLogs)
    .where(
      and(
        eq(deliveryLogs.id, id),
        eq(deliveryLogs.organizationId, organizationId),
        eq(deliveryLogs.environment, environment)
      )
    )
    .returning();

  return null;
};

// -- WEBHOOK INTERNALS --

function normalizeResendPayload(
  payload: WebhookEventBase<any, any>,
  eventType: WebhookEventType
): WebhookEventBase<any, any> {
  if (payload.type && payload.data && typeof payload.data === "object" && "object" in payload.data) {
    const inner = payload.data.object as Record<string, unknown>;
    if (inner && typeof inner === "object" && "object" in inner && !("id" in inner)) {
      return { ...payload, data: { ...payload.data, object: inner.object } };
    }
    return payload;
  }

  const loose = payload as unknown as Record<string, unknown>;
  if (loose.object && typeof loose.object === "object") {
    const layer = loose.object as Record<string, unknown>;
    const eventObject = layer.object && typeof layer.object === "object" ? layer.object : layer;
    return {
      id: (loose.id as string) ?? generateResourceId("wh_evt", "resend", 52),
      type: eventType,
      created: (loose.created as string) ?? new Date().toISOString(),
      livemode: (loose.livemode as boolean) ?? false,
      data: { object: eventObject },
    };
  }

  return payload;
}

export const triggerWebhooks = async <TName extends string, TObject>(
  subscribers: Array<Webhook>,
  eventType: WebhookEventType,
  payloads: Array<WebhookEventBase<TName, TObject>>,
  logId: string
) => {
  const snakePayloads = payloads.map((payload) => toSnakeCase(payload) as WebhookEventBase<TName, TObject>);

  if (subscribers.length === 0) return { success: true, delivered: 0 };

  const results = await Promise.allSettled(
    subscribers.map((webhook) =>
      Promise.all(
        snakePayloads.map((payload) =>
          deliverWebhook(webhook, eventType, payload, generateResourceId("wh_evt", webhook.id, 52))
        )
      )
    )
  );

  return {
    success: true,
    delivered: results.filter((r) => r.status === "fulfilled").length,
  };
};

export const resendDeliveryLog = safeAction(
  async (
    scope: { webhookId?: string } | { appInstallationId?: string },
    eventType: WebhookEventType,
    payload: WebhookEventBase<any, any>,
    orgId?: string,
    env?: Network
  ) => {
    if ("webhookId" in scope) {
      const [webhook] = await retrieveWebhooks(orgId, env, { id: scope.webhookId });
      const normalizedPayload = normalizeResendPayload(payload, eventType);
      const logId = generateResourceId("wh_evt", scope.webhookId!, 52);
      return deliverWebhook(webhook, eventType, normalizedPayload, logId);
    }

    if ("appInstallationId" in scope) {
      const [appInstallation] = await retrieveAppInstallations({ status: "active" }, orgId, env, {
        installationId: scope.appInstallationId,
      });

      const payloadEsquee = toSnakeCase(payload) as WebhookEventBase<any, any>;
      const logId = generateResourceId("wh_evt", scope.appInstallationId!, 52);

      return deliverToApp(
        appInstallation.app,
        appInstallation.app_installation.id,
        {
          ...payloadEsquee,
          organizationId: appInstallation.app_installation.organizationId,
          environment: appInstallation.app_installation.environment,
        },
        logId,
        appInstallation.app_installation.settings
      );
    }
  }
);
