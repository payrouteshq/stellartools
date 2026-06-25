import { resolveAppContext } from "@/app/actions/context";
import { logEvent } from "@/app/actions/db";
import { EMAIL_TYPE_PREFIX } from "@/app/types";
import {
  AppInstallationSettingValue,
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

const LOOPS_EVENT_NAMES: Record<WebhookEventType, string> = {
  "customer.created": "customer_created",
  "customer.updated": "customer_updated",
  "customer.deleted": "customer_deleted",
  "payment_method.created": "payment_method_created",
  "payment_method.deleted": "payment_method_deleted",
  "checkout.created": "checkout_created",
  "payment.pending": "payment_pending",
  "payment.confirmed": "payment_confirmed",
  "payment.failed": "payment_failed",
  "refund.succeeded": "refund_succeeded",
  "refund.failed": "refund_failed",
  "subscription.created": "subscription_created",
  "subscription.updated": "subscription_updated",
  "subscription.canceled": "subscription_canceled",
};

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    st: StellarTools,
    loops: LoopsClient,
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    settings: Record<string, AppInstallationSettingValue>,
    orgId: string | null,
    environment: Network
  ) => Promise<void>;
};

async function sendConfigured(
  loops: LoopsClient,
  eventType: WebhookEventType,
  email: string,
  settings: Record<string, AppInstallationSettingValue>,
  orgId: string | null,
  environment: Network,
  dataVariables?: Record<string, string | number>,
  contactProperties?: Record<string, string | null>
): Promise<void> {
  const raw = settings[`${eventType}.emailConfig`] as string | null | undefined;
  if (!raw) return;

  const colonIdx = raw.indexOf(":");
  const prefix = raw.slice(0, colonIdx);
  const id = raw.slice(colonIdx + 1);

  const mailingListId = settings["contactSyncMailingListId"] as string | null | undefined;

  if (prefix === EMAIL_TYPE_PREFIX.TRANSACTIONAL) {
    await loops.sendTransactionalEmail({ transactionalId: id, email, addToAudience: true, dataVariables });
    if (orgId) logEvent(orgId, environment, eventType, email, "transactional", raw).catch(console.error);
  } else if (prefix === EMAIL_TYPE_PREFIX.WORKFLOW) {
    const eventName = LOOPS_EVENT_NAMES[eventType];
    const mailingLists = mailingListId ? { [mailingListId]: true } : undefined;
    await loops.sendEvent({ email, eventName, contactProperties, mailingLists });
    // Save the event name (e.g. "payment_confirmed") instead of the raw "B:wfl_abc123" settings value.
    // Loops workflows are triggered by event name, not workflow ID — the ID is only used by the
    // dashboard dropdown to remember which workflow the user selected. Storing the event name here
    if (orgId) logEvent(orgId, environment, eventType, email, "event", eventName).catch(console.error);
  }
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (st, loops, event, settings, orgId, environment) => {
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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
    await sendConfigured(
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

    await sendConfigured(loops, "customer.created", event.data.object.email, settings, orgId, environment, undefined, {
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

    await sendConfigured(loops, "customer.deleted", event.data.object.email, settings, orgId, environment, undefined, {
      firstName: event.data.object.name ?? "",
      userId: event.data.object.id,
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

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: Record<string, AppInstallationSettingValue> }>(
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
          settings: Record<string, AppInstallationSettingValue>,
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
