/**
 * App Proxy endpoint.
 * Shopify forwards /apps/stellar-pay/checkout → /proxy/checkout on our server.
 * The theme extension JS calls /apps/stellar-pay/checkout from the storefront —
 * no hardcoded app URL needed in the theme.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { CurrencyCode, StellarTools } from "@stellartools/core";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  return new Response(null, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Shopify signs app proxy requests — shop is guaranteed in the query params
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") ?? "";

  let body: { amount_cents: number; currency_code: string; customer_email?: string; shop_domain?: string; return_url?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const { amount_cents, currency_code, customer_email, return_url } = body;

  if (!shopDomain || !amount_cents || !currency_code) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: CORS });
  }

  const shopRecord = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, shopDomain))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!shopRecord?.stellartoolsApiKey) {
    return new Response(
      JSON.stringify({ error: "StellarTools not configured — add your API key in the app settings" }),
      { status: 400, headers: CORS }
    );
  }

  const st = new StellarTools({ api_key: shopRecord.stellartoolsApiKey });

  const checkout = await st.checkouts.createDirect({
    amount_cents,
    currency_code: currency_code.toUpperCase() as CurrencyCode,
    customer_email,
    redirect_url: return_url ?? `https://${shopDomain}/cart`,
    description: `Shopify order from ${shopDomain}`,
    metadata: { shop_domain: shopDomain },
  });

  return new Response(JSON.stringify({ checkout_url: checkout.payment_url }), { status: 200, headers: CORS });
};
