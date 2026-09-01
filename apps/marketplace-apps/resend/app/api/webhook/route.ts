import { resolveAppContext } from "@/app/actions/context";
import { indexEmail } from "@/app/actions/db";
import {
  AppInstallationSettings,
  HandlerError,
  Network,
  STELLARTOOLS_ID,
  z as Schema,
  StellarTools,
  WebhookEvent,
  WebhookEventBase,
  WebhookEventType,
  WebhookObjectMap,
  WebhookSigner,
  parseJSON,
  routeHandler,
} from "@stellartools/core";
import { NextRequest } from "next/server";
import { Resend } from "resend";

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    st: StellarTools,
    resend: Resend,
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    settings: AppInstallationSettings,
    orgId: string | null,
    environment: Network
  ) => Promise<void>;
};

const SEGMENTS: Record<Network, string> = {
  mainnet: `${STELLARTOOLS_ID}_Live`,
  testnet: `${STELLARTOOLS_ID}_Test`,
};

async function sendAndIndex(
  resend: Resend,
  payload: Parameters<Resend["emails"]["send"]>[0],
  orgId: string | null,
  environment: Network
): Promise<void> {
  const { data, error } = await resend.emails.send(payload);
  if (error) console.error("[sendAndIndex] Resend error:", error);
  if (data?.id && orgId) {
    indexEmail(data.id, orgId, environment).catch((e) => console.error("[indexEmail]", e));
  }
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (st, resend, event, settings, orgId, environment) => {
    const templateId = settings["payment.confirmed.templateId"] as string;
    if (!templateId) return;
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await sendAndIndex(
      resend,
      {
        to: customer.email,
        subject: `Invoice ${event.data.object.id} paid`,
        template: {
          id: templateId,
          variables: { email: customer.email, invoice_id: event.data.object.id, amount: event.data.object.amount },
        },
        tags: [{ name: "source", value: SEGMENTS[environment] }],
      },
      orgId,
      environment
    );
  },
  "payment.failed": async (st, resend, event, settings, orgId, environment) => {
    const templateId = settings["payment.failed.templateId"] as string;
    if (!templateId) return;
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await sendAndIndex(
      resend,
      {
        to: customer.email,
        subject: `Invoice ${event.data.object.id} failed`,
        template: {
          id: templateId,
          variables: { email: customer.email, invoice_id: event.data.object.id, amount: event.data.object.amount },
        },
      },
      orgId,
      environment
    );
  },
  "refund.succeeded": async (st, resend, event, settings, orgId, environment) => {
    const templateId = settings["refund.succeeded.templateId"] as string;
    if (!templateId) return;
    const customerId = event.data.object.customer_id;
    if (!customerId) return;
    const customer = await st.customers.retrieve(customerId);
    await sendAndIndex(
      resend,
      {
        to: customer.email,
        subject: `Refund ${event.data.object.id} succeeded`,
        template: {
          id: templateId,
          variables: { email: customer.email, refund_id: event.data.object.id, amount: event.data.object.amount },
        },
      },
      orgId,
      environment
    );
  },
  "subscription.created": async (st, resend, event, settings, orgId, environment) => {
    const templateId = settings["subscription.created.templateId"] as string;
    if (!templateId) return;
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await sendAndIndex(
      resend,
      {
        to: customer.email,
        subject: `Subscription ${event.data.object.id} created`,
        template: {
          id: templateId,
          variables: { email: customer.email, subscription_id: event.data.object.id },
        },
      },
      orgId,
      environment
    );
  },
  "subscription.canceled": async (st, resend, event, settings, orgId, environment) => {
    const templateId = settings["subscription.canceled.templateId"] as string;
    if (!templateId) return;
    const customer = await st.customers.retrieve(event.data.object.customer_id);
    await sendAndIndex(
      resend,
      {
        to: customer.email,
        subject: `Subscription ${event.data.object.id} canceled`,
        template: {
          id: templateId,
          variables: { email: customer.email, subscription_id: event.data.object.id },
        },
      },
      orgId,
      environment
    );
  },
  "customer.created": async (_st, resend, event, settings, orgId, environment) => {
    const templateId = settings["customer.created.templateId"] as string;
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;

    if (customerSyncEnabled) {
      const { data: segments } = await resend.segments.list();
      let segmentId = segments?.data?.find((s) => s.name === SEGMENTS[environment])?.id;
      if (!segmentId) {
        const { data: created } = await resend.segments.create({ name: SEGMENTS[environment] });
        segmentId = created?.id;
      }
      await resend.contacts.create({
        ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
        email: event.data.object.email,
        firstName: event.data.object.name,
        unsubscribed: false,
        properties: event.data.object.metadata ? { ...event.data.object.metadata } : undefined,
      });
    }

    if (templateId) {
      await sendAndIndex(
        resend,
        {
          tags: [{ name: "source", value: SEGMENTS[environment] }],
          to: event.data.object.email,
          subject: `Customer ${event.data.object.id} created`,
          template: {
            id: templateId,
            variables: { email: event.data.object.email, name: event.data.object.name },
          },
        },
        orgId,
        environment
      );
    }
  },
  "customer.updated": async (_st, resend, event, settings, _orgId, environment) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    if (!customerSyncEnabled) return;

    const { data: segments } = await resend.segments.list();
    let segmentId = segments?.data?.find((s) => s.name === SEGMENTS[environment])?.id;
    if (!segmentId) {
      const { data: created } = await resend.segments.create({ name: SEGMENTS[environment] });
      segmentId = created?.id;
    }

    const contact = await resend.contacts.get({ email: event.data.object.email });
    if (!contact) {
      await resend.contacts.create({
        email: event.data.object.email,
        firstName: event.data.object.name,
        unsubscribed: false,
        properties: event.data.object.metadata ? { ...event.data.object.metadata } : undefined,
      });
    }

    await resend.contacts.update({
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
      email: event.data.object.email,
      firstName: event.data.object.name,
      unsubscribed: false,
      properties: event.data.object.metadata ? { ...event.data.object.metadata } : undefined,
    });
  },
  "customer.deleted": async (_st, resend, event, settings, orgId, environment) => {
    const templateId = settings["customer.deleted.templateId"] as string;
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;

    if (customerSyncEnabled) {
      await resend.contacts.remove({ email: event.data.object.email });
    }

    if (templateId) {
      await sendAndIndex(
        resend,
        {
          to: event.data.object.email,
          subject: `Customer ${event.data.object.id} deleted`,
          template: {
            id: templateId,
            variables: { email: event.data.object.email },
          },
        },
        orgId,
        environment
      );
    }
  },
};

export const POST = routeHandler<NextRequest>(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";
  const appToken = req.headers.get("x-stellartools-app-token") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.RESEND_APP_SECRET!);
  } catch {
    throw new HandlerError("Invalid signature", 401);
  }

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: AppInstallationSettings }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  const st = new StellarTools({ api_key: appToken });

  if (!settings["resendApiKey"]) throw new HandlerError("No API key configured", 404);

  const resend = new Resend(settings["resendApiKey"] as string);
  const appContext = await resolveAppContext(appToken);
  const orgId = appContext?.orgId ?? null;
  const environment: Network = event.livemode ? "mainnet" : "testnet";

  const handler = HANDLERS[event.type] as
    | ((
        st: StellarTools,
        resend: Resend,
        event: WebhookEvent,
        settings: AppInstallationSettings,
        orgId: string | null,
        environment: Network
      ) => Promise<void>)
    | undefined;

  if (!handler) throw new HandlerError("No handler found for event type", 404);

  try {
    await handler(st, resend, event, settings, orgId, environment);
  } catch (err) {
    console.error("[Webhook Error]:", err);
    throw new HandlerError("Processing failed", 500);
  }

  return { ok: true };
});
