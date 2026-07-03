import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { StellarTools } from "@stellartools/core";
import type { Payment } from "@stellartools/core";
import { getShopByDomain } from "~/db.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) {
    return { configured: false, payments: [] as Payment[], shop, stats: null };
  }

  const st = new StellarTools({ api_key: shop.stellartools_api_key });
  const payments = await st.payments.list({ limit: 5 }).catch(() => [] as Payment[]);

  const stats = {
    total: payments.length,
    confirmed: payments.filter((p) => p.status === "confirmed").length,
    pending: payments.filter((p) => p.status === "pending").length,
    failed: payments.filter((p) => p.status === "failed").length,
  };

  return { configured: true, payments, shop: shop!, stats };
}

const STATUS_TONE: Record<string, string> = {
  confirmed: "success",
  pending: "warning",
  failed: "critical",
};

export default function Dashboard() {
  const { configured, payments, shop, stats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <s-page heading="StellarTools Payments">
      {!configured && (
        <s-banner heading="Connect your StellarTools account" tone="warning" dismissible>
          Add your StellarTools API key in Settings to start accepting crypto payments.
          <s-button variant="primary" onClick={() => navigate("/app/settings")}>
            Go to Settings
          </s-button>
        </s-banner>
      )}

      {configured && stats && (
        <s-section heading="Overview">
          <s-stack direction="inline" gap="base">
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-text color="subdued">Total payments</s-text>
                <s-heading>{stats.total}</s-heading>
              </s-stack>
            </s-box>
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-text color="subdued">Confirmed</s-text>
                <s-heading>{stats.confirmed}</s-heading>
              </s-stack>
            </s-box>
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-text color="subdued">Pending</s-text>
                <s-heading>{stats.pending}</s-heading>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>
      )}

      <s-section heading="Recent transactions">
        {payments.length === 0 ? (
          <s-paragraph tone="subdued">
            {configured
              ? "No payments yet. Share your Shopify store to start accepting crypto."
              : "Connect your account above to see payments here."}
          </s-paragraph>
        ) : (
          <>
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header listSlot="primary">Date</s-table-header>
                <s-table-header listSlot="labeled">Amount</s-table-header>
                <s-table-header listSlot="labeled">Asset</s-table-header>
                <s-table-header listSlot="labeled">Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {payments.map((p) => (
                  <s-table-row key={p.id}>
                    <s-table-cell>{new Date(p.created_at).toLocaleDateString()}</s-table-cell>
                    <s-table-cell>
                      {(p.amount_cents / 100).toFixed(2)} {p.currency_code}
                    </s-table-cell>
                    <s-table-cell>{p.selected_asset_code ?? "XLM"}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={STATUS_TONE[p.status] ?? "info"}>{p.status}</s-badge>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            <s-stack direction="inline" gap="base">
              <s-button onClick={() => navigate("/app/transactions")}>View all transactions</s-button>
              <s-link href={process.env.STELLARTOOLS_DASHBOARD_URL!} tone="auto" target="_blank">
                Open StellarTools dashboard ↗
              </s-link>
            </s-stack>
          </>
        )}
      </s-section>

      <s-section heading="Environment">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={shop?.environment === "mainnet" ? "success" : "info"}>
            {shop?.environment === "mainnet" ? "Mainnet — live" : "Testnet — no real money"}
          </s-badge>
          <s-link href="/app/settings" tone="auto">
            Change in Settings
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
