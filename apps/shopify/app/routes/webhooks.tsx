import type { ActionFunctionArgs } from "@remix-run/node";
import { ApiClient, Customer, Product } from "@stellartools/core";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      await db.update(shopifyShops).set({ uninstalledAt: new Date() }).where(eq(shopifyShops.shopDomain, shop));
      break;
    }

    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE": {
      const shopRecord = await db
        .select()
        .from(shopifyShops)
        .where(eq(shopifyShops.shopDomain, shop))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!shopRecord?.stellartoolsApiKey || !shopRecord.settings?.syncProducts) break;

      const product = payload as {
        id: number;
        title: string;
        status: string;
        variants: Array<{ price: string }>;
      };

      const api = new ApiClient({
        baseUrl: process.env.STELLARTOOLS_API_URL!,
        headers: { "x-api-key": shopRecord.stellartoolsApiKey },
      });

      await api.post<Product>("/products", {
        name: product.title,
        type: "one_time",
        price_amount_cents: Math.round(parseFloat(product.variants[0]?.price ?? "0") * 100),
        currency_code: "USD",
        metadata: { shopify_product_id: product.id.toString() },
      });
      break;
    }

    case "PRODUCTS_DELETE": {
      // Products deleted in Shopify — archive in ST via metadata lookup if needed
      // For now, no-op (ST products are retained for payment history)
      break;
    }

    case "CUSTOMERS_CREATE":
    case "CUSTOMERS_UPDATE": {
      const shopRecord = await db
        .select()
        .from(shopifyShops)
        .where(eq(shopifyShops.shopDomain, shop))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!shopRecord?.stellartoolsApiKey || !shopRecord.settings?.syncCustomers) break;

      const customer = payload as {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
      };

      const api = new ApiClient({
        baseUrl: process.env.STELLARTOOLS_API_URL!,
        headers: { "x-api-key": shopRecord.stellartoolsApiKey },
      });

      await api.post<Customer>("/customers", [
        {
          email: customer.email,
          name: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
          phone: customer.phone ?? undefined,
          metadata: { shopify_customer_id: customer.id.toString() },
        },
      ]);
      break;
    }

    case "ORDERS_CANCELLED": {
      // The corresponding ST checkout will expire naturally after 24h.
      // No action needed unless we want to eagerly expire it.
      break;
    }

    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
