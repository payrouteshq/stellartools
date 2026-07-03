import type { ActionFunctionArgs } from "@remix-run/node";
import { type CurrencyCode, StellarTools } from "@stellartools/core";
import { createPaymentSession, getShopByDomain } from "~/db.server";
import type { ShopifyOffsitePaymentMethod, ShopifyPaymentSessionRequest } from "~/types/shopify-payments";

export const action = async ({ request }: ActionFunctionArgs) => {
  const body: ShopifyPaymentSessionRequest = await request.json();

  // Header names from Shopify are lowercase
  const shop = request.headers.get("shopify-shop-domain") ?? "";

  const shopRecord = await getShopByDomain(shop);
  if (!shopRecord?.stellartools_api_key) {
    return Response.json({ error: "StellarTools not configured for this shop" }, { status: 400 });
  }

  const cancelUrl = (body.payment_method as ShopifyOffsitePaymentMethod).data.cancel_url;
  const customerEmail = body.customer?.email ?? undefined;
  const customerPhone = body.customer?.phone_number ?? undefined;

  const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });

  const checkout = await st.checkouts.createDirect(
    {
      amount_cents: Math.round(parseFloat(body.amount) * 100),
      currency_code: body.currency.toUpperCase() as CurrencyCode,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      redirect_url: new URL(
        `/payments/return?gid=${encodeURIComponent(body.gid)}&shop=${encodeURIComponent(shop)}`,
        process.env.SHOPIFY_APP_URL!
      ).toString(),
      description: `Order via ${shop}`,
      metadata: {
        shopify_payment_gid: body.gid,
        shop_domain: shop,
        test: String(body.test),
      },
    },
    { idempotencyKey: body.id }
  );

  if (!checkout || "error" in checkout) {
    return Response.json({ error: (checkout as any)?.error ?? "Failed to create checkout" }, { status: 500 });
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

  return Response.json({ redirect_url: checkout.payment_url });
};
