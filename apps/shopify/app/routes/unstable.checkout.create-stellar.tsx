/**
 * UNSTABLE — demo-only. Delete when Shopify grants Payments Partner access.
 *
 * Files to remove together:
 *   - app/routes/unstable.checkout.create-stellar.tsx  (this file)
 *   - app/routes/unstable.checkout.return.tsx
 *   - extensions/stellar-pay-checkout-ui/
 *
 * The real payment flow uses stellar-pay-offsite (payments_extension) which
 * Shopify calls directly via payment-session / refund-session routes.
 *
 * Route: POST /unstable/checkout/create-stellar
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { CurrencyCode, StellarTools } from "@stellartools/core";
import { createUnstableCheckoutRecord, getShopByDomain } from "~/db.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export const loader = async () => new Response(null, { status: 200, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });

  let body: { shop_domain?: string; amount?: string; currency?: string; customer_email?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { shop_domain, amount = "1.00", currency = "USD", customer_email } = body;

  if (!shop_domain) return json({ error: "shop_domain is required" }, 400);

  const shop = await getShopByDomain(shop_domain);
  if (!shop?.stellartools_api_key) {
    return json({ error: "This store has not connected StellarTools yet." }, 400);
  }

  const st = new StellarTools({ api_key: shop.stellartools_api_key });
  const amountCents = Math.round(parseFloat(amount) * 100);

  const checkout = await st.checkouts
    .createDirect({
      amount_cents: amountCents,
      currency_code: currency.toUpperCase() as CurrencyCode,
      customer_email: customer_email ?? undefined,
      redirect_url: `${process.env.SHOPIFY_APP_URL}/unstable/checkout/return`,
      description: `[DEMO] Shopify checkout — ${shop_domain}`,
      metadata: {
        shop_domain,
        source: "unstable_checkout_ui_extension",
      },
    })
    .catch(() => null);

  if (!checkout || "error" in checkout) {
    return json({ error: (checkout as any)?.error ?? "Failed to create checkout" }, 500);
  }

  await createUnstableCheckoutRecord({
    shop: shop_domain,
    amount,
    currency,
    customerEmail: customer_email ?? null,
    stellartoolsCheckoutId: checkout.id,
  }).catch(() => {});

  return json({ payment_url: checkout.payment_url });
};
