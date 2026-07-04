/** Public app URL — CLI sets HOST during dev; set SHOPIFY_APP_URL in .env to override or when HOST isn't injected. */
export function getAppUrl(): string {
  return (process.env.SHOPIFY_APP_URL || process.env.HOST || "").replace(/\/$/, "");
}

export function getClientEnv() {
  return {
    stellartoolsDashboardUrl: process.env.STELLARTOOLS_DASHBOARD_URL ?? "http://dashboard.localhost:3000",
    shopifyApiKey: process.env.SHOPIFY_API_KEY ?? "",
  };
}
