import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Badge, Banner, BlockStack, Button, Card, DataTable, InlineStack, Layout, Page, Text } from "@shopify/polaris";
import { Payment, StellarTools } from "@stellartools/core";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shop = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, session.shop))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!shop?.stellartoolsApiKey) {
    return { configured: false, payments: [] as Payment[], shop };
  }

  const st = new StellarTools({ api_key: shop.stellartoolsApiKey });
  const payments = await st.payments.list({ limit: 10 }).catch(() => [] as Payment[]);

  return { configured: true, payments, shop };
}

const STATUS_TONE: Record<string, "success" | "warning" | "critical" | "info"> = {
  succeeded: "success",
  pending: "warning",
  failed: "critical",
};

export default function Dashboard() {
  const { configured, payments, shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page
      title="StellarTools Payments"
      subtitle={shop?.environment === "mainnet" ? "Live mode" : "Testnet mode — no real money"}
    >
      <Layout>
        {!configured && (
          <Layout.Section>
            <Banner
              title="Connect your StellarTools account"
              tone="warning"
              action={{
                content: "Go to settings",
                onAction: () => navigate("/app/settings"),
              }}
            >
              <Text as="p">
                Add your StellarTools API key to start accepting crypto payments from Shopify customers.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Recent payments
                </Text>
                <Button variant="plain" onClick={() => navigate("/app/orders")}>
                  View all
                </Button>
              </InlineStack>

              {payments.length === 0 ? (
                <Text as="p" tone="subdued">
                  {configured
                    ? "No payments yet. Share your Shopify store to start accepting crypto."
                    : "Connect your account above to see payments here."}
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Date", "Amount", "Asset", "Status"]}
                  rows={payments.map((p) => [
                    new Date(p.created_at).toLocaleDateString(),
                    `${p.amount_cents / 100} ${p.currency_code}`,
                    p.selected_asset_code ?? "XLM",
                    <Badge key={p.id} tone={STATUS_TONE[p.status] ?? "info"}>
                      {p.status}
                    </Badge>,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
