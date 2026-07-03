import { useState } from "react";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { StellarTools } from "@stellartools/core";
import type { Product, RecurringPeriod } from "@stellartools/core";
import { getShopByDomain } from "~/db.server";
import { authenticate } from "~/shopify.server";

// ─── Shopify product from Admin GraphQL ──────────────────────────────────────

interface ShopifyProduct {
  id: string; // GID e.g. "gid://shopify/Product/123"
  title: string;
  description: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  images: { nodes: Array<{ url: string }> };
}

const LIST_PRODUCTS_QUERY = `
  query ListProducts($cursor: String) {
    products(first: 50, after: $cursor, query: "status:active") {
      nodes {
        id title description status
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        images(first: 1) { nodes { url } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) {
    return { shopifyProducts: [], stProducts: [], configured: false };
  }

  // Fetch Shopify products via Admin GraphQL
  const gqlRes = await admin.graphql(LIST_PRODUCTS_QUERY);
  const { data } = (await gqlRes.json()) as { data: { products: { nodes: ShopifyProduct[] } } };
  const shopifyProducts: ShopifyProduct[] = data?.products?.nodes ?? [];

  // Fetch StellarTools products and find those synced from Shopify (have shopify_product_id in metadata)
  const st = new StellarTools({ api_key: shop.stellartools_api_key });
  const stProducts: Product[] = await st.products.list({ limit: 100 }).catch(() => []);

  return { shopifyProducts, stProducts, configured: true };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const shopifyProductId = form.get("shopifyProductId") as string;
  const name = form.get("name") as string;
  const description = (form.get("description") as string) || undefined;
  const type = form.get("type") as "one_time" | "subscription";
  const priceCents = parseInt(form.get("priceCents") as string, 10);
  const currencyCode = form.get("currencyCode") as string;
  const recurringPeriod = (form.get("recurringPeriod") as RecurringPeriod) || undefined;
  const imageUrl = (form.get("imageUrl") as string) || undefined;

  if (!shopifyProductId || !name || !type || !priceCents || !currencyCode) {
    return { error: "Missing required fields", success: false };
  }

  const shop = await getShopByDomain(session.shop);
  if (!shop?.stellartools_api_key) {
    return { error: "StellarTools not configured", success: false };
  }

  try {
    const st = new StellarTools({ api_key: shop.stellartools_api_key });
    await st.products.create({
      name,
      description,
      type,
      price_amount_cents: priceCents,
      currency_code: currencyCode as Parameters<typeof st.products.create>[0]["currency_code"],
      recurring_period: type === "subscription" ? recurringPeriod : undefined,
      images: imageUrl ? [imageUrl] : [],
      metadata: {
        shopify_product_id: shopifyProductId,
        shop_domain: session.shop,
      },
    });
    return { error: null, success: true, syncedId: shopifyProductId };
  } catch (err) {
    return { error: "Failed to sync product — check your API key", success: false };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

export default function Products() {
  const { shopifyProducts, stProducts, configured } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [productType, setProductType] = useState<"one_time" | "subscription">("one_time");

  // Build a set of Shopify product IDs already synced to StellarTools
  const syncedIds = new Set(
    stProducts.filter((p) => p.metadata?.shopify_product_id).map((p) => p.metadata!.shopify_product_id as string)
  );

  const isSyncing = fetcher.state === "submitting";
  const justSynced =
    fetcher.data?.success && "syncedId" in (fetcher.data ?? {})
      ? (fetcher.data as { syncedId: string }).syncedId
      : null;

  if (justSynced) syncedIds.add(justSynced);

  return (
    <s-page heading="Products">
      {fetcher.data?.success && <s-banner heading="Product synced to StellarTools" tone="success" dismissible />}
      {fetcher.data?.error && <s-banner heading={fetcher.data.error} tone="critical" dismissible />}

      {!configured ? (
        <s-section>
          <s-paragraph tone="subdued">
            Connect your StellarTools account in{" "}
            <s-link href="/app/settings" tone="auto">
              Settings
            </s-link>{" "}
            to sync products.
          </s-paragraph>
        </s-section>
      ) : (
        <>
          <s-section heading="How product sync works">
            <s-paragraph tone="subdued">
              Syncing a Shopify product creates a matching product in StellarTools. One-time products enable direct
              Stellar payments; subscription products enable recurring billing. The StellarTools product ID is stored in
              its metadata as <s-text type="code">shopify_product_id</s-text>.
            </s-paragraph>
          </s-section>

          <s-section heading="Your Shopify products">
            {shopifyProducts.length === 0 ? (
              <s-paragraph tone="subdued">No active products found in your Shopify store.</s-paragraph>
            ) : (
              <s-table variant="auto">
                <s-table-header-row>
                  <s-table-header listSlot="primary">Product</s-table-header>
                  <s-table-header listSlot="labeled">Price</s-table-header>
                  <s-table-header listSlot="labeled">Synced</s-table-header>
                  <s-table-header listSlot="auxiliary">Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {shopifyProducts.map((p) => {
                    const isSynced = syncedIds.has(p.id);
                    const isExpanded = syncingId === p.id;
                    const priceNum = parseFloat(p.priceRangeV2.minVariantPrice.amount);
                    const priceCents = Math.round(priceNum * 100);
                    const currency = p.priceRangeV2.minVariantPrice.currencyCode;
                    const imageUrl = p.images.nodes[0]?.url ?? "";

                    return (
                      <s-table-row key={p.id}>
                        <s-table-cell>
                          <s-stack direction="inline" gap="base" alignItems="center">
                            {imageUrl && <s-thumbnail src={imageUrl} alt={p.title} size="small" />}
                            <s-text>{p.title}</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          {priceNum.toFixed(2)} {currency}
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone={isSynced ? "success" : "neutral"}>
                            {isSynced ? "Synced" : "Not synced"}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell>
                          {!isSynced && !isExpanded && (
                            <s-button
                              variant="secondary"
                              onClick={() => {
                                setSyncingId(p.id);
                                setProductType("one_time");
                              }}
                            >
                              Sync to StellarTools
                            </s-button>
                          )}
                          {isSynced && (
                            <s-link
                              href={`${process.env.STELLARTOOLS_DASHBOARD_URL!}/products`}
                              tone="auto"
                              target="_blank"
                            >
                              View in StellarTools ↗
                            </s-link>
                          )}
                          {isExpanded && (
                            <fetcher.Form method="POST">
                              <input type="hidden" name="shopifyProductId" value={p.id} />
                              <input type="hidden" name="name" value={p.title} />
                              <input type="hidden" name="description" value={p.description ?? ""} />
                              <input type="hidden" name="priceCents" value={priceCents} />
                              <input type="hidden" name="currencyCode" value={currency} />
                              <input type="hidden" name="imageUrl" value={imageUrl} />
                              <input type="hidden" name="type" value={productType} />

                              <s-stack direction="block" gap="base">
                                <s-choice-list
                                  label="Billing type"
                                  name="billingType"
                                  value={productType}
                                  onChange={(e: any) =>
                                    setProductType(e.target?.value ?? e.detail?.value ?? productType)
                                  }
                                >
                                  <s-choice value="one_time">One-time payment — customer pays once</s-choice>
                                  <s-choice value="subscription">Subscription — recurring billing</s-choice>
                                </s-choice-list>

                                {productType === "subscription" && (
                                  <s-select label="Billing interval" name="recurringPeriod">
                                    <s-option value="month">Monthly</s-option>
                                    <s-option value="week">Weekly</s-option>
                                    <s-option value="year">Yearly</s-option>
                                    <s-option value="day">Daily</s-option>
                                  </s-select>
                                )}

                                <s-button-group>
                                  <s-button type="submit" variant="primary" loading={isSyncing}>
                                    Confirm sync
                                  </s-button>
                                  <s-button type="button" onClick={() => setSyncingId(null)}>
                                    Cancel
                                  </s-button>
                                </s-button-group>
                              </s-stack>
                            </fetcher.Form>
                          )}
                        </s-table-cell>
                      </s-table-row>
                    );
                  })}
                </s-table-body>
              </s-table>
            )}
          </s-section>

          {stProducts.filter((p) => p.metadata?.shopify_product_id).length > 0 && (
            <s-section heading="Synced StellarTools products">
              <s-table variant="auto">
                <s-table-header-row>
                  <s-table-header listSlot="primary">Name</s-table-header>
                  <s-table-header listSlot="labeled">Type</s-table-header>
                  <s-table-header listSlot="labeled">Billing</s-table-header>
                  <s-table-header listSlot="labeled">Status</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {stProducts
                    .filter((p) => p.metadata?.shopify_product_id)
                    .map((p) => (
                      <s-table-row key={p.id}>
                        <s-table-cell>{p.name}</s-table-cell>
                        <s-table-cell>
                          <s-badge tone={p.type === "subscription" ? "info" : "neutral"}>
                            {p.type === "subscription" ? "Subscription" : "One-time"}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell>
                          {p.recurring_period ? (PERIOD_LABELS[p.recurring_period] ?? p.recurring_period) : "—"}
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</s-badge>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                </s-table-body>
              </s-table>

              <s-link href={`${process.env.STELLARTOOLS_DASHBOARD_URL!}/products`} tone="auto" target="_blank">
                Manage all products in StellarTools ↗
              </s-link>
            </s-section>
          )}
        </>
      )}
    </s-page>
  );
}
