import { CurrencyCode, StellarTools } from "@stellartools/core";
import { createUnstableCheckoutRecord, getShopByDomain } from "~/db.server";
import { getAppUrl } from "~/env.server";

export type CreateStellarCheckoutBody = {
  shop_domain?: string;
  amount?: string;
  currency?: string;
  customer_email?: string | null;
};

export async function createStellarCheckout(body: CreateStellarCheckoutBody) {
  const { shop_domain, amount = "1.00", currency = "USD", customer_email } = body;

  if (!shop_domain) {
    return { ok: false as const, status: 400, error: "shop_domain is required" };
  }

  const shop = await getShopByDomain(shop_domain);
  if (!shop?.stellartools_api_key) {
    return { ok: false as const, status: 400, error: "This store has not connected StellarTools yet." };
  }

  const st = new StellarTools({ api_key: shop.stellartools_api_key });
  const amountCents = Math.round(parseFloat(amount) * 100);

  try {
    const checkout = await st.checkouts.createDirect({
      amount_cents: amountCents,
      currency_code: currency.toUpperCase() as CurrencyCode,
      customer_email: customer_email ?? undefined,
      redirect_url: `${getAppUrl()}/unstable/checkout/return`,
      description: `[DEMO] Shopify checkout`,
      metadata: {
        platform: "shopify",
        shop_domain,
        source: "unstable_checkout_ui_extension",
      },
    });

    await createUnstableCheckoutRecord({
      shop: shop_domain,
      amount,
      currency,
      customerEmail: customer_email ?? null,
      stellartoolsCheckoutId: checkout.id,
    }).catch(() => {});

    return { ok: true as const, payment_url: checkout.payment_url };
  } catch (error) {
    return {
      ok: false as const,
      status: 500,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
