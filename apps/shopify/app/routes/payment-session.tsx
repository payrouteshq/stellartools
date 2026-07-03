/**
 * Shopify calls this endpoint when a customer selects "Stellar Pay" in checkout.
 * We create a StellarTools checkout and return its URL so Shopify can redirect the customer.
 *
 * Shopify expects: HTTP 200 + { redirect_url: "..." }
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { CurrencyCode, StellarTools } from "@stellartools/core";
import { createPaymentSession, getShopByDomain } from "~/db.server";

interface ShopifyPaymentSessionRequest {
  id: string;
  gid: string;
  group: string;
  amount: string;
  currency: string;
  test: boolean;
  kind: string;
  customer: {
    email?: string;
    billing_address?: Record<string, unknown>;
    shipping_address?: Record<string, unknown>;
  };
  payment_method: { type: string; data: Record<string, unknown> };
  proposed_at: string;
  cancel_url: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const body: ShopifyPaymentSessionRequest = await request.json();
  const shop = request.headers.get("shopify-shop-domain") ?? "";

  const shopRecord = await getShopByDomain(shop);
  if (!shopRecord?.stellartools_api_key) {
    return new Response(JSON.stringify({ error: "StellarTools not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });

  const amountCents = Math.round(parseFloat(body.amount) * 100);
  const customerEmail = body.customer?.email ?? undefined;

  const checkout = await st.checkouts.createDirect({
    amount_cents: amountCents,
    currency_code: body.currency.toUpperCase() as CurrencyCode,
    customer_email: customerEmail,
    redirect_url: `${process.env.SHOPIFY_APP_URL}/payment-complete/${body.id}`,
    description: `Shopify order — ${shop}`,
    metadata: {
      payment_session_id: body.gid,
      shop_domain: shop,
    },
  });

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
    customerEmail: customerEmail ?? null,
    cancelUrl: body.cancel_url,
    stellartoolsCheckoutId: checkout.id,
  });

  return new Response(JSON.stringify({ redirect_url: checkout.payment_url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
