/**
 * Shopify calls this when a merchant initiates a refund from the Shopify admin.
 * We look up the original StellarTools payment and create a StellarTools refund.
 * Resolution (resolve/reject) happens when StellarTools fires refund.succeeded/failed webhook.
 *
 * Shopify expects: HTTP 201
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { StellarTools } from "@stellartools/core";
import { createRefundSession, getPaymentSessionByGid, getShopByDomain } from "~/db.server";
import type { ShopifyRefundSessionRequest } from "~/types/shopify-payments";

export const action = async ({ request }: ActionFunctionArgs) => {
  const body: ShopifyRefundSessionRequest = await request.json();
  const shop = request.headers.get("shopify-shop-domain") ?? "";

  const shopRecord = await getShopByDomain(shop);
  if (!shopRecord?.stellartools_api_key) {
    return new Response(null, { status: 500 });
  }

  // Look up the original payment session to find the StellarTools payment ID
  const paymentSession = await getPaymentSessionByGid(body.payment_id);
  const stellartoolsPaymentId = paymentSession?.stellartools_payment_id ?? null;

  let stellartoolsRefundId: string | null = null;

  if (stellartoolsPaymentId) {
    const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });
    try {
      const refund = await st.refunds.create({
        payment_id: stellartoolsPaymentId,
        reason: "Merchant initiated refund via Shopify admin",
        metadata: { refund_session_gid: body.gid, shop_domain: shop },
      });
      stellartoolsRefundId = refund.id;
    } catch {
      // Refund creation failed — session is still recorded for manual follow-up
    }
  }

  await createRefundSession({
    id: body.id,
    gid: body.gid,
    shop,
    paymentGid: body.payment_id,
    amount: body.amount,
    currency: body.currency,
    stellartoolsRefundId,
  });

  // HTTP 201 = "received, processing asynchronously"
  return new Response(JSON.stringify({ id: body.id, gid: body.gid }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
