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

// StellarTools payments are captured immediately at checkout — no pre-authorization hold.
// Shopify may still call this endpoint; we acknowledge it with 200.
export const action = async ({ request }: ActionFunctionArgs) => {
  const shopifySecret = process.env.SHOPIFY_API_SECRET ?? "";
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");

  if (!verifyShopifyHmac(rawBody, hmacHeader, shopifySecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
