import type { ActionFunctionArgs } from "@remix-run/node";
import { StellarTools } from "@stellartools/core";
import { getShopByDomain, markShopUninstalled, updateShopWebhook } from "~/db.server";
import { authenticate } from "~/shopify.server";

interface ShopifyCustomerPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      const shopRecord = await getShopByDomain(shop);
      if (shopRecord?.stellartools_api_key && shopRecord.stellartools_webhook_id) {
        const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });
        await st.webhooks.delete(shopRecord.stellartools_webhook_id).catch(() => {});
        await updateShopWebhook(shop, null, null);
      }
      await markShopUninstalled(shop);
      break;
    }

    case "CUSTOMERS_CREATE": {
      const shopRecord = await getShopByDomain(shop);
      if (!shopRecord?.stellartools_api_key) break;

      const c = payload as ShopifyCustomerPayload;
      const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });

      const metadata = {
        shopify_customer_id: String(c.id),
        shop_domain: shop,
      };

      // May already exist if they paid before registering — update metadata rather than duplicate
      const existing = await st.customers.list({ email: c.email }).catch(() => []);
      const existingArr = Array.isArray(existing) ? existing : [];

      if (existingArr.length > 0) {
        await st.customers.update(existingArr[0].id, { metadata }).catch(() => {});
      } else {
        await st.customers
          .create({
            email: c.email,
            name: `${c.first_name} ${c.last_name}`.trim() || c.email,
            phone: c.phone ?? undefined,
            metadata,
          })
          .catch(() => {});
      }
      break;
    }

    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE":
      // Product webhooks are informational — sync is merchant-initiated from the Products page
      break;

    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
