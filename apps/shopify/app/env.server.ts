/** Public app URL — during `pnpm dev`, CLI injects HOST with the live tunnel; SHOPIFY_APP_URL is for production. */
export function getAppUrl(): string {
  return (process.env.HOST || process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
}

export function getClientEnv() {
  return {
    stellartoolsDashboardUrl: process.env.STELLARTOOLS_DASHBOARD_URL ?? "http://dashboard.localhost:3000",
    shopifyApiKey: process.env.SHOPIFY_API_KEY ?? "",
  };
}
