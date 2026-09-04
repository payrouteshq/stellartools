import { postCheckout, retrieveCredentials, retrieveDueSchedules } from "@/app/actions/db";
import { HandlerError, StellarTools, currencyCodeSchema, routeHandler } from "@stellartools/core";

export const GET = routeHandler(async (req) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    throw new HandlerError("Unauthorized", 401);
  }

  const due = await retrieveDueSchedules();
  const results: Array<{ ghlSubscriptionId: string; checkoutId?: string; error?: string }> = [];

  for (const schedule of due) {
    try {
      const credentials = await retrieveCredentials({
        locationId: schedule.location_id,
        environment: schedule.environment,
      });
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

      await postCheckout({
        checkoutId: checkout.id,
        locationId: schedule.location_id,
        environment: schedule.environment,
        ghlTransactionId: `renewal_${schedule.ghl_subscription_id}_${Date.now()}`,
        ghlContactId: schedule.contact_id,
        ghlSubscriptionId: schedule.ghl_subscription_id,
      });

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
