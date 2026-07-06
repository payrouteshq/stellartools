import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { StellarTools } from "@stellartools/core";
import type { Customer, Product, Subscription } from "@stellartools/core";
import { getCustomerEmailsByShop, getShopByDomain } from "~/db.server";
import { useEmbeddedPath } from "~/hooks/use-embedded-navigation";
import { authenticate } from "~/shopify.server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubscriptionRow {
  sub: Subscription;
  customer: Pick<Customer, "id" | "email" | "name">;
  product: Pick<Product, "id" | "name" | "price_amount_cents" | "recurring_period" | "unit"> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthlyAmount(product: SubscriptionRow["product"]): number {
  if (!product) return 0;
  const price = product.price_amount_cents / 100;
  switch (product.recurring_period) {
    case "year":
      return price / 12;
    case "week":
      return price * 4.33;
    case "day":
      return price * 30;
    default:
      return price; // month or custom
  }
}

function formatAmount(cents: number, unit?: string): string {
  return `${(cents / 100).toFixed(2)} ${unit ?? ""}`.trim();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_TONE: Record<string, string> = {
  active: "success",
  trialing: "info",
  past_due: "critical",
  paused: "warning",
  canceled: "subdued",
};

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) {
    return { configured: false, rows: [] as SubscriptionRow[], stats: null, error: null };
  }

  const st = new StellarTools({ api_key: shop.stellartools_api_key });

  // 1. Emails of customers who've transacted through this shop
  const emails = await getCustomerEmailsByShop(session.shop);

  if (emails.length === 0) {
    return { configured: true, rows: [], stats: { total: 0, active: 0, pastDue: 0, mrr: 0, mrrUnit: "" }, error: null };
  }

  // 2. Resolve emails → StellarTools customers (parallel)
  const customerResults = await Promise.all(
    emails.map((email) => st.customers.list({ email }).catch(() => [] as Customer[]))
  );
  const customers = customerResults.flat();

  if (customers.length === 0) {
    return { configured: true, rows: [], stats: { total: 0, active: 0, pastDue: 0, mrr: 0, mrrUnit: "" }, error: null };
  }

  // 3. Subscriptions for each customer (parallel)
  const subResults = await Promise.all(
    customers.map((c) =>
      st.subscriptions
        .list(c.id)
        .then((subs) => subs.map((s) => ({ sub: s, customer: c })))
        .catch(() => [])
    )
  );
  const subsWithCustomers = subResults.flat();

  // 4. Unique products (parallel)
  const uniqueProductIds = [...new Set(subsWithCustomers.map((x) => x.sub.product_id))];
  const productResults = await Promise.all(uniqueProductIds.map((id) => st.products.retrieve(id).catch(() => null)));
  const productMap = new Map<string, Product>(
    productResults.filter((p): p is Product => p !== null).map((p) => [p.id, p])
  );

  // 5. Join
  const rows: SubscriptionRow[] = subsWithCustomers.map(({ sub, customer }) => {
    const product = productMap.get(sub.product_id) ?? null;
    return {
      sub,
      customer: { id: customer.id, email: customer.email, name: customer.name },
      product: product
        ? {
            id: product.id,
            name: product.name,
            price_amount_cents: product.price_amount_cents,
            recurring_period: product.recurring_period,
            unit: product.unit,
          }
        : null,
    };
  });

  // 6. Stats
  const active = rows.filter((r) => r.sub.status === "active");
  const pastDue = rows.filter((r) => r.sub.status === "past_due");
  const mrr = active.reduce((sum, r) => sum + monthlyAmount(r.product), 0);
  const mrrUnit = active[0]?.product?.unit ?? "";

  return {
    configured: true,
    rows,
    stats: { total: rows.length, active: active.length, pastDue: pastDue.length, mrr, mrrUnit },
    error: null,
  };
}

// ─── Action (pause / resume / cancel) ────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) return { error: "Not configured" };

  const form = await request.formData();
  const intent = form.get("intent") as string;
  const id = form.get("id") as string;

  const st = new StellarTools({ api_key: shop.stellartools_api_key });

  try {
    if (intent === "pause") await st.subscriptions.pause(id);
    if (intent === "resume") await st.subscriptions.resume(id);
    if (intent === "cancel") await st.subscriptions.cancel(id);
    return { error: null };
  } catch {
    return { error: `Failed to ${intent} subscription` };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const { configured, rows, stats, error } = useLoaderData<typeof loader>();
  const settingsPath = useEmbeddedPath("/app/settings");
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  function handleAction(intent: string, id: string, periodEnd?: string) {
    if (
      intent === "cancel" &&
      !confirm(
        periodEnd
          ? `Cancel this subscription at the end of the billing period (${formatDate(periodEnd)})? The customer keeps access until then.`
          : "Cancel this subscription at the end of the billing period? The customer keeps access until then."
      )
    ) {
      return;
    }
    submit({ intent, id }, { method: "POST" });
  }

  if (!configured) {
    return (
      <s-page heading="Subscriptions">
        <s-banner heading="Connect your StellarTools account" tone="warning">
          Add your StellarTools API key in Settings to see subscriptions.
          <s-link href={settingsPath} tone="auto">
            Go to Settings
          </s-link>
        </s-banner>
      </s-page>
    );
  }

  return (
    <s-page heading="Subscriptions Management">
      {(error || actionData?.error) && (
        <s-banner heading={error ?? actionData?.error ?? ""} tone="critical" dismissible />
      )}

      {/* ── Stats row ─────────────────────────────────────────── */}
      {stats && (
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text color="subdued">Total Subscriptions</s-text>
              <s-heading>{stats.total}</s-heading>
              <s-badge tone="success">{stats.active} active</s-badge>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text color="subdued">Monthly Recurring Revenue</s-text>
              <s-heading>{stats.mrr > 0 ? `${stats.mrr.toFixed(2)} ${stats.mrrUnit}` : "—"}</s-heading>
              <s-text color="subdued">Active subscriptions</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text color="subdued">Needs Attention</s-text>
              <s-heading>{stats.pastDue}</s-heading>
              <s-badge tone={stats.pastDue > 0 ? "critical" : "success"}>
                {stats.pastDue > 0 ? "Past due subscriptions" : "All payments current"}
              </s-badge>
            </s-stack>
          </s-box>
        </s-grid>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <s-section heading="All Subscriptions">
        {rows.length === 0 ? (
          <s-paragraph tone="subdued">
            No subscriptions found. Subscriptions appear here once customers subscribe to a StellarTools product that
            was purchased through this store.
          </s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Customer</s-table-header>
              <s-table-header listSlot="labeled">Plan</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
              <s-table-header listSlot="labeled">Amount</s-table-header>
              <s-table-header listSlot="labeled">Next Billing</s-table-header>
              <s-table-header listSlot="labeled">Actions</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {rows.map(({ sub, customer, product }) => (
                <s-table-row key={sub.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="none">
                      <s-text type="strong">{customer.name}</s-text>
                      <s-text color="subdued">{customer.email}</s-text>
                    </s-stack>
                  </s-table-cell>

                  <s-table-cell>
                    {product?.name ?? sub.product_id}
                    {product?.recurring_period && <s-text color="subdued"> · {product.recurring_period}</s-text>}
                  </s-table-cell>

                  <s-table-cell>
                    <s-badge tone={(STATUS_TONE[sub.status] ?? "info") as any}>
                      {sub.cancel_at_period_end && sub.status !== "canceled"
                        ? `cancels on ${formatDate(sub.current_period_end)}`
                        : sub.status.replace("_", " ")}
                    </s-badge>
                    {sub.failed_payment_count && sub.failed_payment_count > 0 && (
                      <s-text color="critical"> {sub.failed_payment_count} failed</s-text>
                    )}
                  </s-table-cell>

                  <s-table-cell>{product ? formatAmount(product.price_amount_cents, product.unit) : "—"}</s-table-cell>

                  <s-table-cell>{formatDate(sub.current_period_end)}</s-table-cell>

                  <s-table-cell>
                    <s-stack direction="inline" gap="tight">
                      {sub.status === "active" && (
                        <s-button
                          variant="tertiary"
                          tone="auto"
                          loading={isSubmitting}
                          onClick={() => handleAction("pause", sub.id)}
                        >
                          Pause
                        </s-button>
                      )}
                      {sub.status === "paused" && (
                        <s-button
                          variant="tertiary"
                          tone="auto"
                          loading={isSubmitting}
                          onClick={() => handleAction("resume", sub.id)}
                        >
                          Resume
                        </s-button>
                      )}
                      {sub.status !== "canceled" && !sub.cancel_at_period_end && (
                        <s-button
                          variant="tertiary"
                          tone="critical"
                          loading={isSubmitting}
                          onClick={() => handleAction("cancel", sub.id, sub.current_period_end)}
                        >
                          Cancel
                        </s-button>
                      )}
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
