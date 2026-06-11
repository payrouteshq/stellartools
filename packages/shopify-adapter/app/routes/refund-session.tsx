import crypto from "node:crypto";
import type { ActionFunctionArgs } from "react-router";

function verifyShopifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopifySecret = process.env.SHOPIFY_API_SECRET ?? "";
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");

  if (!verifyShopifyHmac(rawBody, hmacHeader, shopifySecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    id: string;
    payment_id: string;
    amount: string;
    currency: string;
    shop: string;
    merchant_reference: string;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { id, payment_id, amount, currency, shop, merchant_reference } = payload;

  // TODO: In production, trigger Stellar payment reversal using the payment_id.
  // For now, log and acknowledge receipt.
  console.log("[refund-session] Refund requested", {
    id,
    payment_id,
    amount,
    currency,
    shop,
    merchant_reference,
  });

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
