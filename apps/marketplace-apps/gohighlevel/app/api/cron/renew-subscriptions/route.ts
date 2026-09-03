import { getCredentials, listDueSchedules, recordCheckout } from "@/app/actions/db";
import { HandlerError, StellarTools, currencyCodeSchema, routeHandler } from "@stellartools/core";

/**
 * Runs hourly (see vercel.json). For each due interactive-recurring schedule, creates a fresh
 * StellarTools checkout for the next billing cycle. This only *creates* the checkout — the
 * customer still has to complete it (see README: "why payments are ... interactive recurring").
 * Wiring an actual notification (email/SMS) to the customer is deployment-specific and left as
 * an extension point below.
 */
export const GET = routeHandler(async (req) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    throw new HandlerError("Unauthorized", 401);
  }

  const due = await listDueSchedules();
  const results: Array<{ ghlSubscriptionId: string; checkoutId?: string; error?: string }> = [];

  for (const schedule of due) {
    try {
      const credentials = await getCredentials(schedule.location_id, schedule.environment);
      if (!credentials) throw new Error("No StellarTools credentials for this location/environment");

      const stellar = new StellarTools({ api_key: credentials.stellarApiKey });
      const checkout = await stellar.checkouts.createDirect({
        amount_cents: schedule.amount_cents,
        currency_code: currencyCodeSchema.parse(schedule.currency_code),
        description: "Subscription renewal",
        metadata: {
          ghl_subscription_id: schedule.ghl_subscription_id,
          ghl_location_id: schedule.location_id,
          ghl_contact_id: schedule.contact_id,
        },
      });

      await recordCheckout({
        checkoutId: checkout.id,
        locationId: schedule.location_id,
        environment: schedule.environment,
        ghlTransactionId: `renewal_${schedule.ghl_subscription_id}_${Date.now()}`,
        ghlContactId: schedule.contact_id,
        ghlSubscriptionId: schedule.ghl_subscription_id,
      });

      // Extension point: notify the customer (email/SMS) with `checkout.payment_url`, e.g. via
      // GHL's Conversations API using the location's OAuth access token, or your own provider.

      results.push({ ghlSubscriptionId: schedule.ghl_subscription_id, checkoutId: checkout.id });
    } catch (err) {
      results.push({
        ghlSubscriptionId: schedule.ghl_subscription_id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { processed: results.length, results };
});
