import { resolveAppContext } from "@/app/actions/context";
import {
  AppInstallationSettings,
  Network,
  WebhookEvent,
  WebhookEventBase,
  WebhookEventType,
  WebhookObjectMap,
  WebhookSigner,
  z as Schema,
  parseJSON,
} from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    settings: AppInstallationSettings,
    orgId: string | null,
    environment: Network
  ) => Promise<void>;
};

function capture(apiKey: string, distinctId: string, event: string, properties: Record<string, unknown>) {
  return fetch("https://app.posthog.com/capture/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId, event, properties }),
  });
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const p = event.data.object;
    const [rawAmt, currency] = String(p.amount).split(" ");
    const amountCents = parseInt(rawAmt) || 0;
    await capture(key, p.customer_id, "payment_confirmed", {
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency: currency ?? "USD",
      checkout_id: p.checkout_id,
      transaction_hash: p.transaction_hash,
      ...(p.metadata ?? {}),
      $set: { last_payment_status: "confirmed" },
    });
  },
  "payment.failed": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const p = event.data.object;
    const [rawAmt, currency] = String(p.amount).split(" ");
    const amountCents = parseInt(rawAmt) || 0;
    await capture(key, p.customer_id, "payment_failed", {
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency: currency ?? "USD",
      $set: { last_payment_status: "failed" },
    });
  },
  "subscription.created": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const s = event.data.object;
    await capture(key, s.customer_id, "subscription_created", {
      product_id: s.product_id,
      status: s.status,
      $set: { product_id: s.product_id, subscription_status: s.status },
    });
  },
  "subscription.updated": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const s = event.data.object;
    const prev = (event.data.previous_attributes ?? {}) as Record<string, unknown>;
    const $set: Record<string, unknown> = {};
    if ("product_id" in prev) $set.product_id = s.product_id;
    if ("status" in prev) $set.subscription_status = s.status;
    await capture(key, s.customer_id, "subscription_updated", {
      product_id: s.product_id,
      status: s.status,
      ...(Object.keys($set).length ? { $set } : {}),
    });
  },
  "subscription.canceled": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const s = event.data.object;
    await capture(key, s.customer_id, "subscription_canceled", {
      $set: { subscription_status: "canceled" },
    });
  },
  "refund.succeeded": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const r = event.data.object;
    if (r.customer_id) await capture(key, r.customer_id, "refund_created", { amount: r.amount });
  },
  "refund.failed": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const r = event.data.object;
    if (r.customer_id) await capture(key, r.customer_id, "refund_failed", { amount: r.amount });
  },
  "customer.created": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const c = event.data.object;
    await capture(key, c.id, "customer_created", { $set: { email: c.email, name: c.name } });
  },
  "customer.updated": async (event, settings) => {
    const key = settings["posthogProjectToken"] as string;
    const c = event.data.object;
    await capture(key, c.id, "customer_updated", { $set: { email: c.email, name: c.name } });
  },
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";
  const appToken = req.headers.get("x-stellartools-app-token") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.POSTHOG_APP_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: AppInstallationSettings }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  try {
    if (!settings["posthogProjectToken"]) {
      return NextResponse.json({ error: "No project token configured" }, { status: 404 });
    }

    const appContext = await resolveAppContext(appToken);
    const orgId = appContext?.orgId ?? null;
    const environment: Network = event.livemode ? "mainnet" : "testnet";

    const handler = HANDLERS[event.type] as
      | ((
          event: WebhookEvent,
          settings: AppInstallationSettings,
          orgId: string | null,
          environment: Network
        ) => Promise<void>)
      | undefined;

    if (!handler) {
      return NextResponse.json({ error: "No handler for event type" }, { status: 404 });
    }

    await handler(event, settings, orgId, environment);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[PostHog Webhook Error]:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
