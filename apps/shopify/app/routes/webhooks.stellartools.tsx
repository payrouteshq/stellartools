/**
 * Receives StellarTools webhook events.
 *
 * payment.confirmed → backup resolver (primary resolution happens on /payment-complete)
 * payment.failed    → reject the Shopify payment session
 * refund.succeeded  → resolve the Shopify refund session
 * refund.failed     → reject the Shopify refund session
 *
 * StellarTools POSTs to: /webhooks/stellartools?shop=<shop-domain>
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { type Payment, type Refund, WebhookSigner } from "@stellartools/core";
import {
  getPaymentSessionByCheckoutId,
  getRefundSessionByStellarRefundId,
  getShopByDomain,
  markPaymentSessionResolved,
  updatePaymentSessionPaymentId,
} from "~/db.server";
import {
  rejectPaymentSession,
  rejectRefundSession,
  resolvePaymentSession,
  resolveRefundSession,
} from "~/payments-apps.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") ?? "";

  const rawBody = await request.text();
  const signature = request.headers.get("x-stellartools-signature") ?? "";

  const shopRecord = await getShopByDomain(shopDomain);
  if (!shopRecord?.stellartools_webhook_secret || !shopRecord.stellartools_api_key) {
    return new Response(null, { status: 200 });
  }

  let event;
  try {
    event = new WebhookSigner().constructEvent(rawBody, signature, shopRecord.stellartools_webhook_secret);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (event.type === "payment.confirmed") {
    const payment = event.data.object as Payment;

    // Store the StellarTools payment ID against the payment session so refunds can find it later
    await updatePaymentSessionPaymentId(payment.checkout_id, payment.id).catch(() => {});

    // Backup resolver: if the customer closed their browser before /payment-complete ran, resolve here
    const session = await getPaymentSessionByCheckoutId(payment.checkout_id);
    if (session && session.status !== "resolved") {
      await markPaymentSessionResolved(session.id);
      // Unstable/demo sessions have no real Shopify GID — skip the resolve call
      if (session.gid) {
        await resolvePaymentSession(shopDomain, shopRecord.access_token, session.gid).catch(() => {});
      }
    }
  }

  if (event.type === "payment.failed") {
    const payment = event.data.object as Payment;
    const session = await getPaymentSessionByCheckoutId(payment.checkout_id);
    if (session && session.status === "pending") {
      await rejectPaymentSession(shopDomain, shopRecord.access_token, session.gid).catch(() => {});
    }
  }

  if (event.type === "refund.succeeded") {
    const refund = event.data.object as Refund;
    const refundSession = await getRefundSessionByStellarRefundId(refund.id);
    if (refundSession) {
      await resolveRefundSession(shopDomain, shopRecord.access_token, refundSession.gid).catch(() => {});
    }
  }

  if (event.type === "refund.failed") {
    const refund = event.data.object as Refund;
    const refundSession = await getRefundSessionByStellarRefundId(refund.id);
    if (refundSession) {
      await rejectRefundSession(shopDomain, shopRecord.access_token, refundSession.gid).catch(() => {});
    }
  }

  return new Response(null, { status: 200 });
};
