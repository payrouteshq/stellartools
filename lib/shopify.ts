import "@shopify/shopify-api/adapters/node";
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";

type ShopifyClient = ReturnType<typeof shopifyApi>;
let _shopify: ShopifyClient | null = null;

export function getShopify(): ShopifyClient {
  if (_shopify) return _shopify;

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecretKey = process.env.SHOPIFY_API_SECRET;
  const appUrl = process.env.APP_URL;

  if (!apiKey) throw new Error("SHOPIFY_API_KEY is required");
  if (!apiSecretKey) throw new Error("SHOPIFY_API_SECRET is required");
  if (!appUrl) throw new Error("APP_URL is required");

  _shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes: ["read_orders", "write_orders"],
    hostName: appUrl.replace(/^https?:\/\//, ""),
    apiVersion: ApiVersion.October25,
    isEmbeddedApp: true,
  });

  return _shopify;
}

export const shopify = new Proxy({} as ShopifyClient, {
  get(_target, prop) {
    return Reflect.get(getShopify(), prop);
  },
});
