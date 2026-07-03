import type { ActionFunctionArgs } from "@remix-run/node";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      await db
        .update(shopifyShops)
        .set({ uninstalledAt: new Date() })
        .where(eq(shopifyShops.shopDomain, shop));
      break;
    }

    case "ORDERS_CANCELLED": {
      // ST checkout expires naturally after 24h — no action needed.
      break;
    }

    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
