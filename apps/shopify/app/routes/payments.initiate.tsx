import type { ActionFunctionArgs } from "@remix-run/node";
import { type CurrencyCode, StellarTools } from "@stellartools/core";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getShopByDomain } from "~/db.server";

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

  const shopRecord = await getShopByDomain(shop);

  if (!shopRecord?.stellartools_api_key) {
    return Response.json({ error: "StellarTools not configured for this shop" }, { status: 400 });
  }

  const st = new StellarTools({ api_key: shopRecord.stellartools_api_key! });

  const returnUrl = new URL(
    `/payments/return?gid=${encodeURIComponent(payload.gid)}&shop=${encodeURIComponent(shop)}`,
    process.env.SHOPIFY_APP_URL!
  );

  const checkout = await st.checkouts.createDirect({
    amount_cents: Math.round(parseFloat(payload.amount) * 100),
    currency_code: payload.currency.toUpperCase() as CurrencyCode,
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
