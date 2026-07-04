import { ApiVersion, DeliveryMethod, shopifyApp } from "@shopify/shopify-app-remix/server";
import { PgSessionStorage, upsertShop } from "~/db.server";
import { getAppUrl } from "~/env.server";

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: ApiVersion.October25,
  scopes: [],
  appUrl: getAppUrl(),
  authPathPrefix: "/auth",
  sessionStorage: new PgSessionStorage(),
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      console.log("afterAuth", session);
      await shopify.registerWebhooks({ session });
      await upsertShop(session.shop, session.accessToken!);
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
