import { resolveAppContext } from "@/app/actions/context";
import { indexEmail } from "@/app/actions/db";
import {
  AppInstallationSettingValue,
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
} from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    st: StellarTools,
    resend: Resend,
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    settings: Record<string, AppInstallationSettingValue>,
    orgId: string | null
  ) => Promise<void>;
};

const SEGMENTS: Record<Network, string> = {
  mainnet: `${STELLARTOOLS_ID}_Live`,
  testnet: `${STELLARTOOLS_ID}_Test`,
};

async function sendAndIndex(
  resend: Resend,
  payload: Parameters<Resend["emails"]["send"]>[0],
  orgId: string | null
): Promise<void> {
  const { data, error } = await resend.emails.send(payload);
  if (error) console.error("[sendAndIndex] Resend error:", error);
  if (data?.id && orgId) {
    indexEmail(data.id, orgId).catch((e) => console.error("[indexEmail]", e));
  }
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (st, resend, event, settings, orgId) => {
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
        tags: [{ name: "source", value: SEGMENTS[event.livemode ? "mainnet" : "testnet"] }],
      },
      orgId
    );
  },
  "payment.failed": async (st, resend, event, settings, orgId) => {
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
      orgId
    );
  },
  "refund.succeeded": async (st, resend, event, settings, orgId) => {
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
      orgId
    );
  },
  "subscription.created": async (st, resend, event, settings, orgId) => {
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
      orgId
    );
  },
  "subscription.canceled": async (st, resend, event, settings, orgId) => {
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
      orgId
    );
  },
  "customer.created": async (st, resend, event, settings, orgId) => {
    const templateId = settings["customer.created.templateId"] as string;
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    const network = event.livemode ? "mainnet" : "testnet";

    console.log({ templateId });

    if (customerSyncEnabled) {
      const { data: segments } = await resend.segments.list();
      let segmentId = segments?.data?.find((s) => s.name === SEGMENTS[network])?.id;

      if (!segmentId) {
        const { data: created } = await resend.segments.create({ name: SEGMENTS[network] });
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
          tags: [{ name: "source", value: SEGMENTS[network] }],
          to: event.data.object.email,
          subject: `Customer ${event.data.object.id} created`,
          template: {
            id: templateId,
            variables: { email: event.data.object.email, name: event.data.object.name },
          },
        },
        orgId
      );
    }
  },
  "customer.updated": async (st, resend, event, settings, orgId) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    const network = event.livemode ? "mainnet" : "testnet";

    if (!customerSyncEnabled) return;

    const { data: segments } = await resend.segments.list();
    let segmentId = segments?.data?.find((s) => s.name === SEGMENTS[network])?.id;

    if (!segmentId) {
      const { data: created } = await resend.segments.create({ name: SEGMENTS[network] });
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
  "customer.deleted": async (st, resend, event, settings, orgId) => {
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
        orgId
      );
    }
  },
};

export async function POST(req: NextRequest) {
  console.log("req", req);
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";
  const appToken = req.headers.get("x-stellartools-app-token") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.RESEND_APP_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("appToken", appToken);
  console.log("signature", signature);

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: Record<string, AppInstallationSettingValue> }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  console.log("event", event);
  console.log("settings", settings);

  try {
    const st = new StellarTools({ api_key: appToken });

    if (!settings["resendApiKey"]) {
      return NextResponse.json({ error: "No API key configured" }, { status: 404 });
    }

    const resend = new Resend(settings["resendApiKey"] as string);
    const appContext = await resolveAppContext(appToken);
    const orgId = appContext?.orgId ?? null;

    console.log({ orgId });

    const handler = HANDLERS[event.type] as
      | ((
          st: StellarTools,
          resend: Resend,
          event: WebhookEvent,
          settings: Record<string, AppInstallationSettingValue>,
          orgId: string | null
        ) => Promise<void>)
      | undefined;

    if (!handler) {
      return NextResponse.json({ error: "No handler found for event type" }, { status: 404 });
    }

    await handler(st, resend, event, settings, orgId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[Webhook Error]:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
