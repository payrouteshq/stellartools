import { putCheckout, putSchedule, retrieveCheckout, retrieveCredentials, retrieveSchedule } from "@/app/actions/db";
import {
  buildPaymentCapturedWebhook,
  buildSubscriptionChargedWebhook,
  chargeSnapshotFromPayment,
  sendGhlCustomProviderWebhook,
} from "@/lib/ghl";
import { HandlerError, StellarTools, WebhookSigner, routeHandler } from "@stellartools/core";

export const POST = routeHandler(async (req, { params }) => {
  const { ghlSecret } = params;
  const credentials = await retrieveCredentials({ secret: ghlSecret });
  if (!credentials?.webhookSecret) throw new HandlerError("Unknown webhook", 404);

  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";

  let event;
  try {
    event = new WebhookSigner().constructEvent(rawBody, signature, credentials.webhookSecret);
  } catch {
    throw new HandlerError("Invalid signature", 401);
  }

  if (event.type !== "payment.confirmed") return { ok: true };

  const payment = event.data.object;
  await putCheckout(payment.checkout_id, { paymentId: payment.id, status: "completed" });

  const checkout = await retrieveCheckout(payment.checkout_id);
  if (!checkout) return { ok: true };

  const chargeSnapshot = chargeSnapshotFromPayment(payment);

  if (checkout.ghl_subscription_id) {
    const schedule = await retrieveSchedule(checkout.ghl_subscription_id);
    let nextChargeAt: Date;

    if (schedule) {
      nextChargeAt = new Date(Date.now() + schedule.interval_days * 24 * 60 * 60 * 1000);
      await putSchedule(checkout.ghl_subscription_id, {
        status: "active",
        nextChargeAt,
        lastCheckoutId: payment.checkout_id,
      });
    } else if (payment.subscription_id) {
      const stellar = new StellarTools({ api_key: credentials.stellarApiKey });
      const subscription = await stellar.subscriptions.retrieve(payment.subscription_id);
      nextChargeAt = new Date(subscription.current_period_end);
    } else {
      nextChargeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await sendGhlCustomProviderWebhook(
      buildSubscriptionChargedWebhook({
        apiKey: ghlSecret,
        locationId: checkout.location_id,
        ghlSubscriptionId: checkout.ghl_subscription_id,
        chargeSnapshot,
        subscriptionSnapshot: {
          id: checkout.ghl_subscription_id,
          status: "active",
          nextCharge: Math.floor(nextChargeAt.getTime() / 1000),
        },
        marketplaceAppId: process.env.GHL_MARKETPLACE_APP_ID,
      })
    );
  } else {
    await sendGhlCustomProviderWebhook(
      buildPaymentCapturedWebhook({
        apiKey: ghlSecret,
        locationId: checkout.location_id,
        ghlTransactionId: checkout.ghl_transaction_id,
        chargeSnapshot,
        marketplaceAppId: process.env.GHL_MARKETPLACE_APP_ID,
      })
    );
  }

  return { ok: true };
});
