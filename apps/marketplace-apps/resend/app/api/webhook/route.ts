import { indexEmail } from "@/app/actions/db";
import { AppContext, parseAppContext } from "@stellartools/app-sdk";
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
    appContext: AppContext | null
  ) => Promise<void>;
};

const SEGMENTS: Record<Network, string> = {
  mainnet: `${STELLARTOOLS_ID} (Live)`,
  testnet: `${STELLARTOOLS_ID} (Test)`,
};

async function sendAndIndex(
  resend: Resend,
  payload: Parameters<Resend["emails"]["send"]>[0],
  orgId: string | null
): Promise<void> {
  const { data } = await resend.emails.send(payload);
  if (data?.id && orgId) await indexEmail(data.id, orgId);
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (st, resend, event, settings, appContext) => {
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
      appContext?.orgId ?? null
    );
  },
  "payment.failed": async (st, resend, event, settings, appContext) => {
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
      appContext?.orgId ?? null
    );
  },
  "refund.succeeded": async (st, resend, event, settings, appContext) => {
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
      appContext?.orgId ?? null
    );
  },
  "subscription.created": async (st, resend, event, settings, appContext) => {
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
      appContext?.orgId ?? null
    );
  },
  "subscription.canceled": async (st, resend, event, settings, appContext) => {
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
      appContext?.orgId ?? null
    );
  },
  "customer.created": async (st, resend, event, settings, appContext) => {
    const templateId = settings["customer.created.templateId"] as string;
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    const network = event.livemode ? "mainnet" : "testnet";

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
        appContext?.orgId ?? null
      );
    }
  },
  "customer.updated": async (st, resend, event, settings) => {
    const customerSyncEnabled = settings["customerSyncEnabled"] as boolean;
    const network = event.livemode ? "mainnet" : "testnet";

    if (!customerSyncEnabled) return;

    const { data: segments } = await resend.segments.list();
    let segmentId = segments?.data?.find((s) => s.name === SEGMENTS[network])?.id;

    if (!segmentId) {
      const { data: created } = await resend.segments.create({ name: SEGMENTS[network] });
      segmentId = created?.id;
    }

    await resend.contacts.update({
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
      email: event.data.object.email,
      firstName: event.data.object.name,
      unsubscribed: false,
      properties: event.data.object.metadata ? { ...event.data.object.metadata } : undefined,
    });
  },
  "customer.deleted": async (st, resend, event, settings, appContext) => {
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
        appContext?.orgId ?? null
      );
    }
  },
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";
  const appToken = req.headers.get("x-stellartools-app-token") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.RESEND_APP_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: Record<string, AppInstallationSettingValue> }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  try {
    const st = new StellarTools({ api_key: appToken });

    if (!settings["resendApiKey"]) {
      return NextResponse.json({ error: "No API key configured" }, { status: 404 });
    }

    const resend = new Resend(settings["resendApiKey"] as string);
    const context = parseAppContext(appToken, process.env.RESEND_APP_SECRET!);

    const handler = HANDLERS[event.type] as
      | ((
          st: StellarTools,
          resend: Resend,
          event: WebhookEvent,
          settings: Record<string, AppInstallationSettingValue>,
          appContext: AppContext | null
        ) => Promise<void>)
      | undefined;

    if (!handler) {
      return NextResponse.json({ error: "No handler found for event type" }, { status: 404 });
    }

    await handler(st, resend, event, settings, context);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error(`[Webhook Error]: ${err instanceof Error ? err.message : "Unknown error"}`);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
