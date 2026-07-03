import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Badge, BlockStack, Card, DataTable, Layout, Link, Page, Text } from "@shopify/polaris";
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
    return { payments: [] as Payment[], configured: false };
  }

  const st = new StellarTools({ api_key: shop.stellartoolsApiKey });
  const payments = await st.payments.list({ limit: 50 }).catch(() => [] as Payment[]);

  return { configured: true, payments };
}

const STATUS_TONE: Record<string, "success" | "warning" | "critical" | "info"> = {
  succeeded: "success",
  pending: "warning",
  failed: "critical",
};

export default function Orders() {
  const { payments, configured } = useLoaderData<typeof loader>();

  return (
    <Page title="Orders">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Stellar payments
              </Text>

              {!configured ? (
                <Text as="p" tone="subdued">
                  Connect your StellarTools account in <Link url="/app/settings">Settings</Link> to see payments here.
                </Text>
              ) : payments.length === 0 ? (
                <Text as="p" tone="subdued">
                  No payments yet.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Date", "Amount", "Asset", "Tx Hash", "Status"]}
                  rows={payments.map((p) => [
                    new Date(p.created_at).toLocaleDateString(),
                    `${p.amount_cents / 100} ${p.currency_code}`,
                    p.selected_asset_code ?? "XLM",
                    p.transaction_hash ? (
                      <Link key={p.id} url={`https://stellar.expert/explorer/public/tx/${p.transaction_hash}`} external>
                        {p.transaction_hash.slice(0, 12)}…
                      </Link>
                    ) : (
                      "—"
                    ),
                    <Badge key={`status-${p.id}`} tone={STATUS_TONE[p.status] ?? "info"}>
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
