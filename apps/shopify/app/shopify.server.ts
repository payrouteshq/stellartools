import { ApiVersion, DeliveryMethod, shopifyApp } from "@shopify/shopify-app-remix/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, shopifyShops } from "~/db.server";
import { DrizzleSessionStorage } from "~/session.server";

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.January25,
  scopes: [
    "read_products",
    "write_products",
    "read_customers",
    "write_customers",
    "read_orders",
    "write_orders",
    "write_payment_gateways",
    "write_payment_sessions",
  ],
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage: new DrizzleSessionStorage(),
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    PRODUCTS_DELETE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_DELETE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    ORDERS_CANCELLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      shopify.registerWebhooks({ session });

      // Upsert the shop record after OAuth completes
      const existing = await db
        .select()
        .from(shopifyShops)
        .where(eq(shopifyShops.shopDomain, session.shop))
        .limit(1)
        .then((r) => r[0]);

      if (!existing) {
        await db.insert(shopifyShops).values({
          id: `sh_${nanoid(20)}`,
          shopDomain: session.shop,
          accessToken: session.accessToken!,
          environment: "testnet",
          settings: {
            syncProducts: true,
            syncCustomers: true,
          },
          installedAt: new Date(),
        });
      } else {
        await db
          .update(shopifyShops)
          .set({
            accessToken: session.accessToken!,
            uninstalledAt: null,
          })
          .where(eq(shopifyShops.shopDomain, session.shop));
      }
    },
  },
  isEmbeddedApp: true,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
