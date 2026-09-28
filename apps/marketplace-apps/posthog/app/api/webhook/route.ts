import {
  AppInstallationSettings,
  HandlerError,
  Network,
  z as Schema,
  WebhookEvent,
  WebhookEventBase,
  WebhookEventType,
  WebhookObjectMap,
  WebhookSigner,
  parseJSON,
  routeHandler,
} from "@stellartools/core";
import { NextRequest } from "next/server";
import { PostHog } from "posthog-node";

type WebhookHandlers = {
  [K in WebhookEventType]?: (
    event: WebhookEventBase<K, WebhookObjectMap[K]>,
    track: (event: string, properties: Record<string, unknown>) => void
  ) => Promise<void>;
};

function parseAmount(raw: unknown) {
  const [rawAmt, currency] = String(raw).split(" ");
  return { amountCents: parseInt(rawAmt) || 0, currency: currency ?? "USD" };
}

const HANDLERS: WebhookHandlers = {
  "payment.confirmed": async (event, track) => {
    const p = event.data.object;
    const { amountCents, currency } = parseAmount(p.amount);
    track("payment_confirmed", {
      stellartools_customer_id: p.customer_id,
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency,
      checkout_id: p.checkout_id,
      transaction_hash: p.transaction_hash,
      ...(p.metadata ?? {}),
    });
  },
  "payment.pending": async (event, track) => {
    const p = event.data.object;
    const { amountCents, currency } = parseAmount(p.amount);
    track("payment_pending", {
      stellartools_customer_id: p.customer_id,
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency,
    });
  },
  "payment.failed": async (event, track) => {
    const p = event.data.object;
    const { amountCents, currency } = parseAmount(p.amount);
    track("payment_failed", {
      stellartools_customer_id: p.customer_id,
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency,
    });
  },
  "subscription.created": async (event, track) => {
    const s = event.data.object;
    track("subscription_created", {
      stellartools_customer_id: s.customer_id,
      product_id: s.product_id,
      status: s.status,
    });
  },
  "subscription.updated": async (event, track) => {
    const s = event.data.object;
    track("subscription_updated", {
      stellartools_customer_id: s.customer_id,
      product_id: s.product_id,
      status: s.status,
    });
  },
  "subscription.canceled": async (event, track) => {
    const s = event.data.object;
    track("subscription_canceled", {
      stellartools_customer_id: s.customer_id,
      status: s.status,
    });
  },
  "refund.succeeded": async (event, track) => {
    const r = event.data.object;
    if (!r.customer_id) return;
    const { amountCents, currency } = parseAmount(r.amount);
    track("refund_succeeded", {
      stellartools_customer_id: r.customer_id,
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency,
    });
  },
  "refund.failed": async (event, track) => {
    const r = event.data.object;
    if (!r.customer_id) return;
    const { amountCents, currency } = parseAmount(r.amount);
    track("refund_failed", {
      stellartools_customer_id: r.customer_id,
      amount: amountCents / 100,
      amount_cents: amountCents,
      currency,
    });
  },
  "customer.created": async (event, track) => {
    const c = event.data.object;
    track("customer_created", { stellartools_customer_id: c.id, email: c.email, name: c.name });
  },
  "customer.updated": async (event, track) => {
    const c = event.data.object;
    track("customer_updated", { stellartools_customer_id: c.id, email: c.email, name: c.name });
  },
};

export const POST = routeHandler<NextRequest>(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";

  const signer = new WebhookSigner();

  try {
    signer.constructEvent(rawBody, signature, process.env.POSTHOG_APP_SECRET!);
  } catch {
    throw new HandlerError("Invalid signature", 401);
  }

  const { event, settings } = parseJSON<{ event: WebhookEvent; settings: AppInstallationSettings }>(
    rawBody,
    Schema.object({ event: Schema.any(), settings: Schema.any() })
  );

  const projectToken = settings["posthogProjectToken"] as string | undefined;
  if (!projectToken) throw new HandlerError("No project token configured", 404);

  const handler = HANDLERS[event.type] as
    | ((event: WebhookEvent, track: (event: string, properties: Record<string, unknown>) => void) => Promise<void>)
    | undefined;

  if (!handler) throw new HandlerError("No handler for event type", 404);

  const environment: Network = event.livemode ? "mainnet" : "testnet";

  const posthog = new PostHog(projectToken, { flushAt: 1, flushInterval: 0 });

  const track = (eventName: string, properties: Record<string, unknown>) => {
    const distinctId = String(properties.stellartools_customer_id ?? "anonymous");
    const $set: Record<string, unknown> = {};
    if (properties.email != null) $set.email = properties.email;
    if (properties.name != null) $set.name = properties.name;
    posthog.capture({
      distinctId,
      event: eventName,
      properties: { ...properties, environment, ...(Object.keys($set).length ? { $set } : {}) },
    });
  };

  try {
    await handler(event, track);
    await posthog.shutdown();
  } catch (err) {
    console.error("[PostHog Webhook Error]:", err);
    throw new HandlerError("Processing failed", 500);
  }

  return { ok: true };
});
