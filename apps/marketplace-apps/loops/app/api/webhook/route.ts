import { resolveAppContext } from "@/app/actions/context";
import { logEvent } from "@/app/actions/db";
import {
  AppInstallationSettings,
  Network,
  z as Schema,
  StellarTools,
  WebhookEvent,
  WebhookEventBase,
  WebhookEventType,
  WebhookObjectMap,
  WebhookSigner,
  parseJSON,
} from "@stellartools/core";
import { LoopsClient } from "loops";
import { NextRequest, NextResponse } from "next/server";

const toEventName = (eventType: WebhookEventType) => eventType.replaceAll(".", "_");

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    st: StellarTools,
    loops: LoopsClient,
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    settings: AppInstallationSettings,
    orgId: string | null,
    environment: Network
  ) => Promise<void>;
};

async function dispatch(
  loops: LoopsClient,
  eventType: WebhookEventType,
  email: string,
  settings: AppInstallationSettings,
  orgId: string | null,
  environment: Network,
  dataVariables?: Record<string, string | number>,
  contactProperties?: Record<string, string | null>
): Promise<void> {
  const raw = settings[`${eventType}.templateId`] as string | null | undefined;
  // Strip legacy "A:" prefix if present from settings saved before the prefix system was removed.
  const transactionalId = raw?.startsWith("A:") ? raw.slice(2) : raw;
  const mailingListId = settings["contactSyncMailingListId"] as string | null | undefined;
  const mailingLists = mailingListId ? { [mailingListId]: true } : undefined;
  const eventName = toEventName(eventType);

  // Always fire sendEvent — if the merchant has a Loops workflow with this trigger, it runs automatically.
  await loops.sendEvent({ email, eventName, contactProperties, mailingLists });
  if (orgId) logEvent(orgId, environment, eventType, email, "event", eventName).catch(console.error);

  // Also send transactional email if the merchant selected one for this event.
  if (transactionalId) {
    const contactVars = { email, ...Object.fromEntries(Object.entries(contactProperties ?? {}).filter(([, v]) => v != null)) } as Record<string, string>;
    await loops.sendTransactionalEmail({ transactionalId, email, addToAudience: true, dataVariables: { ...contactVars, ...dataVariables } });
    if (orgId) logEvent(orgId, environment, eventType, email, "transactional", transactionalId).catch(console.error);
  }
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "payment.confirmed",
      customer.email,
      settings,
      orgId,
      environment,
      { invoice_id: event.data.object.id, amount: event.data.object.amount },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "payment.failed": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "payment.failed",
      customer.email,
      settings,
      orgId,
      environment,
      { invoice_id: event.data.object.id, amount: event.data.object.amount },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "payment.pending": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "payment.pending",
      customer.email,
      settings,
      orgId,
      environment,
      { invoice_id: event.data.object.id, amount: event.data.object.amount },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "refund.succeeded": async (st, loops, event, settings, orgId, environment) => {
    const customerId = event.data.object.customer_id;
    if (!customerId) return;
    const customer = await st.customers.retrieve(customerId);
    await dispatch(
      loops,
      "refund.succeeded",
      customer.email,
      settings,
      orgId,
      environment,
      { refund_id: event.data.object.id, amount: event.data.object.amount },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "refund.failed": async (st, loops, event, settings, orgId, environment) => {
    const customerId = event.data.object.customer_id;
    if (!customerId) return;
    const customer = await st.customers.retrieve(customerId);
    await dispatch(
      loops,
      "refund.failed",
      customer.email,
      settings,
      orgId,
      environment,
      { refund_id: event.data.object.id },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "subscription.created": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "subscription.created",
      customer.email,
      settings,
      orgId,
      environment,
      { subscription_id: event.data.object.id },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "subscription.updated": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "subscription.updated",
      customer.email,
      settings,
      orgId,
      environment,
      { subscription_id: event.data.object.id },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "subscription.canceled": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await dispatch(
      loops,
      "subscription.canceled",
      customer.email,
      settings,
      orgId,
      environment,
      { subscription_id: event.data.object.id },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "checkout.created": async (st, loops, event, settings, orgId, environment) => {
    const customerId = event.data.object.customer_id;
    if (!customerId) return;
    const customer = await st.customers.retrieve(customerId);
    await dispatch(
      loops,
      "checkout.created",
      customer.email,
      settings,
      orgId,
      environment,
      { checkout_id: event.data.object.id },
      { firstName: customer.name ?? "", userId: customer.id }
    );
  },
  "customer.created": async (_st, loops, event, settings, orgId, environment) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    const mailingListId = settings["contactSyncMailingListId"] as string | null | undefined;

    if (customerSyncEnabled) {
      const mailingLists = mailingListId ? { [mailingListId]: true } : undefined;
      await loops
        .createContact({
          email: event.data.object.email,
          properties: { firstName: event.data.object.name ?? "", userId: event.data.object.id },
          mailingLists,
        })
        .catch(console.error);
    }

    await dispatch(loops, "customer.created", event.data.object.email, settings, orgId, environment, undefined, {
      firstName: event.data.object.name ?? "",
      userId: event.data.object.id,
    });
  },
  "customer.updated": async (_st, loops, event, settings) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    if (!customerSyncEnabled) return;

    await loops
      .updateContact({
        email: event.data.object.email,
        properties: { firstName: event.data.object.name ?? "" },
      })
      .catch(console.error);
  },
  "customer.deleted": async (_st, loops, event, settings, orgId, environment) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;

    if (customerSyncEnabled) {
      await loops.deleteContact({ email: event.data.object.email }).catch(console.error);
    }

    await dispatch(loops, "customer.deleted", event.data.object.email, settings, orgId, environment, undefined, {
      firstName: event.data.object.name ?? "",
      userId: event.data.object.id,
      email: event.data.object.email,
    });
  },
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";
  const appToken = req.headers.get("x-stellartools-app-token") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.LOOPS_APP_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: AppInstallationSettings }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  try {
    const st = new StellarTools({ api_key: appToken });

    if (!settings["loopsApiKey"]) {
      return NextResponse.json({ error: "No API key configured" }, { status: 404 });
    }

    const loops = new LoopsClient(settings["loopsApiKey"] as string);
    const appContext = await resolveAppContext(appToken);
    const orgId = appContext?.orgId ?? null;
    const environment: Network = event.livemode ? "mainnet" : "testnet";

    const handler = HANDLERS[event.type] as
      | ((
          st: StellarTools,
          loops: LoopsClient,
          event: WebhookEvent,
          settings: AppInstallationSettings,
          orgId: string | null,
          environment: Network
        ) => Promise<void>)
      | undefined;

    if (!handler) {
      return NextResponse.json({ error: "No handler for event type" }, { status: 404 });
    }

    await handler(st, loops, event, settings, orgId, environment);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[Webhook Error]:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
