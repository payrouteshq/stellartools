/**
 * Shopify calls this endpoint when a customer selects "Stellar Pay" in checkout.
 * We create a StellarTools checkout and return its URL so Shopify can redirect the customer.
 *
 * Security: authenticated via mTLS at the infrastructure level (not HMAC — per Shopify docs,
 * HMAC applies to installation requests only, not payment operation requests).
 *
 * Shopify expects: HTTP 200 + { redirect_url: "..." } (max 8192 bytes)
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { CurrencyCode, StellarTools } from "@stellartools/core";
import { createPaymentSession, getShopByDomain } from "~/db.server";
import type { ShopifyOffsitePaymentMethod, ShopifyPaymentSessionRequest } from "~/types/shopify-payments";

export const action = async ({ request }: ActionFunctionArgs) => {
  const body: ShopifyPaymentSessionRequest = await request.json();
  const shop = request.headers.get("shopify-shop-domain") ?? "";

  // Shopify-Request-Id is a tracing identifier only — idempotency key is body.id
  const requestId = request.headers.get("shopify-request-id");

  const shopRecord = await getShopByDomain(shop);
  if (!shopRecord?.stellartools_api_key) {
    return new Response(JSON.stringify({ error: "StellarTools not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // cancel_url lives inside payment_method.data for offsite type
  const cancelUrl = (body.payment_method as ShopifyOffsitePaymentMethod).data.cancel_url;
  const customerEmail = body.customer?.email ?? undefined;
  const customerPhone = body.customer?.phone_number ?? undefined;

  const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });
  const amountCents = Math.round(parseFloat(body.amount) * 100);

  const checkout = await st.checkouts.createDirect({
    amount_cents: amountCents,
    currency_code: body.currency.toUpperCase() as CurrencyCode,
    customer_email: customerEmail,
    redirect_url: `${process.env.SHOPIFY_APP_URL}/payment-complete/${body.id}`,
    description: `Shopify order — ${shop}`,
    metadata: {
      payment_session_id: body.gid,
      payment_session_group: body.group,
      shop_domain: shop,
      test: String(body.test),
      ...(requestId ? { shopify_request_id: requestId } : {}),
    },
  }, { idempotencyKey: body.id });

  if ("error" in checkout) {
    return new Response(JSON.stringify({ error: checkout.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await createPaymentSession({
    id: body.id,
    gid: body.gid,
    shop,
    amount: body.amount,
    currency: body.currency,
    customerEmail: customerEmail ?? customerPhone ?? null,
    cancelUrl,
    stellartoolsCheckoutId: checkout.id,
  });

  return new Response(JSON.stringify({ redirect_url: checkout.payment_url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
