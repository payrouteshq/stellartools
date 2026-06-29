/**
 * Offsite Payment Extension endpoint.
 *
 * Shopify POSTs here when a buyer selects "Pay with Stellar" at checkout.
 * We verify the request via HMAC, create a StellarTools checkout, and return
 * the redirect URL for Shopify to send the buyer to.
 *
 * Requires Shopify Payments Partner approval before Shopify will call this.
 * The endpoint is fully built and ready — wire it in the Partner Dashboard
 * once access is granted.
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { StellarTools } from "@stellartools/core";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, shopifyShops } from "~/db.server";

type ShopifyPaymentPayload = {
  id: string;
  gid: string;
  payment_method: { data: Record<string, string> };
  amount: string;
  currency: string;
  test: boolean;
  merchant_provided_details: {
    customer_email?: string;
    customer_phone?: string;
  };
};

function verifyShopifyHmac(body: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac("sha256", process.env.SHOPIFY_API_SECRET!).update(body, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const rawBody = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-SHA256");

  if (!verifyShopifyHmac(rawBody, hmac)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as ShopifyPaymentPayload;
  const shop = request.headers.get("X-Shopify-Shop-Domain") ?? "";

  const shopRecord = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, shop))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!shopRecord?.stellartoolsApiKey) {
    return Response.json({ error: "StellarTools not configured for this shop" }, { status: 400 });
  }

  const st = new StellarTools({ api_key: shopRecord.stellartoolsApiKey });

  const returnUrl = new URL(
    `/payments/return?gid=${encodeURIComponent(payload.gid)}&shop=${encodeURIComponent(shop)}`,
    process.env.SHOPIFY_APP_URL!
  );

  const checkout = await st.checkouts.createDirect({
    amount_cents: Math.round(parseFloat(payload.amount) * 100),
    currency_code: payload.currency.toUpperCase() as Parameters<typeof st.checkouts.createDirect>[0]["currency_code"],
    customer_email: payload.merchant_provided_details?.customer_email,
    customer_phone: payload.merchant_provided_details?.customer_phone,
    redirect_url: returnUrl.toString(),
    description: `Order via ${shop}`,
    metadata: {
      shopify_payment_gid: payload.gid,
      shop_domain: shop,
    },
  });

  return Response.json({ redirect_url: checkout.payment_url });
};
