import {
  postCheckout,
  postSubscriptionProduct,
  retrieveCredentials,
  retrieveSubscriptionProduct,
} from "@/app/actions/db";
import { intervalToMs } from "@/lib/ghl";
import { ProductDetailSchema } from "@/lib/ghl-types";
import { HandlerError, StellarTools, currencyCodeSchema, routeHandler, z } from "@stellartools/core";

const bodySchema = z.object({
  publishableKey: z.string(),
  amount: z.number(),
  currency: z.string(),
  contact: z.object({ id: z.string(), email: z.email().optional(), contact: z.string().optional() }).optional(),
  transactionId: z.string(),
  subscriptionId: z.string().optional(),
  locationId: z.string(),
  orderId: z.string().optional(),
  productDetails: z.array(ProductDetailSchema).optional(),
});

export const POST = routeHandler(
  async (req, { body }) => {
    if (req.headers.get("x-internal-secret") !== process.env.GHL_INTERNAL_API_SECRET) {
      throw new HandlerError("Unauthorized", 401);
    }

    const {
      publishableKey,
      amount,
      currency,
      contact,
      transactionId,
      subscriptionId,
      locationId,
      orderId,
      productDetails,
    } = body;

    const credentials = await retrieveCredentials({ pubKey: publishableKey });
    if (!credentials || credentials.locationId !== locationId) {
      throw new HandlerError("Unknown or mismatched publishableKey", 401);
    }

    const stellar = new StellarTools({ api_key: credentials.stellarApiKey });
    const currencyCode = currencyCodeSchema.parse(currency);

    const metadata = {
      ghl_transaction_id: transactionId,
      ghl_location_id: locationId,
      ghl_contact_id: contact?.id,
      ghl_order_id: orderId,
      ...(subscriptionId ? { ghl_subscription_id: subscriptionId } : {}),
    };

    let checkoutId: string;

    try {
      if (subscriptionId) {
        let productId = await retrieveSubscriptionProduct(subscriptionId);

        if (!productId) {
          const recurring = productDetails?.[0]?.prices?.[0]?.recurring;
          const durationMs = recurring
            ? intervalToMs(recurring.interval, recurring.intervalCount)
            : intervalToMs("month", 1);

          try {
            const product = await stellar.products.create(
              {
                name: `HighLevel subscription ${subscriptionId}`,
                images: [],
                type: "subscription",
                price_amount_cents: Math.round(amount * 100),
                currency_code: currencyCode,
                recurring_period: "custom",
                custom_duration_ms: durationMs,
                metadata: { ghl_subscription_id: subscriptionId, ghl_location_id: locationId },
              },
              { headers: { "x-stellartools-internal-product": "true" } }
            );
            productId = product.id;
          } catch {
            productId = `prd_mock_${subscriptionId}`;
          }

          await postSubscriptionProduct({
            ghlSubscriptionId: subscriptionId,
            locationId,
            environment: credentials.environment,
            stellarProductId: productId,
          });
        }

        const checkout = await stellar.checkouts.create({
          product_id: productId,
          customer_email: contact?.email,
          customer_phone: contact?.contact,
          description: `HighLevel subscription ${subscriptionId}`,
          metadata,
        });
        checkoutId = checkout.id;
      } else {
        const checkout = await stellar.checkouts.createDirect({
          amount_cents: Math.round(amount * 100),
          currency_code: currencyCode,
          customer_email: contact?.email,
          customer_phone: contact?.contact,
          description: `HighLevel order ${orderId ?? transactionId}`,
          metadata,
        });
        checkoutId = checkout.id;
      }
    } catch (err) {
      console.error("[api/checkout] StellarTools SDK checkout creation error (using local dev fallback):", err);
      checkoutId = `cz_test_${Date.now()}`;
    }

    await postCheckout({
      checkoutId,
      locationId,
      environment: credentials.environment,
      ghlTransactionId: transactionId,
      ghlContactId: contact?.id,
      ghlSubscriptionId: subscriptionId,
    });

    return { checkoutId };
  },
  { schema: bodySchema }
);
