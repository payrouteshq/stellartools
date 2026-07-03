import { ApiVersion, DeliveryMethod, shopifyApp } from "@shopify/shopify-app-remix/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, shopifyShops } from "~/db.server";
import { DrizzleSessionStorage } from "~/session.server";

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.October25,
  scopes: [],
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage: new DrizzleSessionStorage(),
  webhooks: {
    APP_UNINSTALLED: {
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
          settings: null,
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
});

export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
