import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { ApiClient, Product } from "@stellartools/core";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";
import { authenticate } from "~/shopify.server";

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        status
        featuredImage { url }
        variants(first: 1) {
          nodes {
            id
            price
          }
        }
        metafield(namespace: "stellartools", key: "product_id") {
          value
        }
      }
    }
  }
`;

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  const shop = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, session.shop))
    .limit(1)
    .then((r) => r[0] ?? null);

  type ShopifyProduct = {
    id: string;
    title: string;
    status: string;
    featuredImage: { url: string } | null;
    variants: { nodes: Array<{ id: string; price: string }> };
    metafield: { value: string } | null;
  };

  if (!shop?.stellartoolsApiKey) {
    return { products: [] as ShopifyProduct[], configured: false };
  }

  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 50 },
  });
  const { data } = await response.json();

  return {
    configured: true,
    products: data.products.nodes as ShopifyProduct[],
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const shopifyProductId = form.get("shopifyProductId") as string;
  const title = form.get("title") as string;
  const price = form.get("price") as string;

  const shop = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, session.shop))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!shop?.stellartoolsApiKey) {
    return { error: "Not configured", success: false };
  }

  const api = new ApiClient({
    baseUrl: process.env.STELLARTOOLS_API_URL!,
    headers: { "x-api-key": shop.stellartoolsApiKey },
  });

  const result = await api.post<Product>("/products", {
    name: title,
    type: "one_time",
    price_amount_cents: Math.round(parseFloat(price) * 100),
    currency_code: "USD",
    metadata: { shopify_product_id: shopifyProductId },
  });

  if (result.isErr()) return { error: "Failed to sync product", success: false };
  const stProduct = result.value;

  // Store the ST product ID in Shopify as a metafield
  await admin.graphql(
    `mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { metafields { id } }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopifyProductId,
            namespace: "stellartools",
            key: "product_id",
            value: stProduct.id,
            type: "single_line_text_field",
          },
        ],
      },
    }
  );

  return { error: null, success: true, stProductId: stProduct.id };
}

export default function Products() {
  const { products, configured } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const syncProduct = (product: (typeof products)[number]) => {
    const variant = product.variants.nodes[0];
    fetcher.submit(
      {
        shopifyProductId: product.id,
        title: product.title,
        price: variant?.price ?? "0",
      },
      { method: "POST" }
    );
  };

  return (
    <Page title="Products">
      <Layout>
        {!configured && (
          <Layout.Section>
            <Banner
              title="Connect your StellarTools account first"
              tone="warning"
              action={{ content: "Go to settings", url: "/app/settings" }}
            />
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Shopify products
                </Text>
                <Text as="p" tone="subdued">
                  {products.length} products
                </Text>
              </InlineStack>

              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Product", "Price", "Synced to ST", "Action"]}
                rows={products.map((p) => {
                  const price = p.variants.nodes[0]?.price ?? "—";
                  const synced = !!p.metafield?.value;

                  return [
                    <InlineStack key={p.id} gap="200" blockAlign="center">
                      <Thumbnail source={p.featuredImage?.url ?? ImageIcon} alt={p.title} size="small" />
                      <Text as="span" variant="bodyMd">
                        {p.title}
                      </Text>
                    </InlineStack>,
                    `$${price}`,
                    synced ? <Badge tone="success">Synced</Badge> : <Badge>Not synced</Badge>,
                    <Button
                      key={`sync-${p.id}`}
                      size="slim"
                      loading={fetcher.state !== "idle" && fetcher.formData?.get("shopifyProductId") === p.id}
                      onClick={() => syncProduct(p)}
                      disabled={!configured}
                    >
                      {synced ? "Re-sync" : "Sync to ST"}
                    </Button>,
                  ];
                })}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
