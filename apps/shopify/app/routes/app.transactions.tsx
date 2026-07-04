import { useState } from "react";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { StellarTools } from "@stellartools/core";
import type { Payment } from "@stellartools/core";
import { getShopByDomain } from "~/db.server";
import { getClientEnv } from "~/env.server";
import { useEmbeddedPath } from "~/hooks/use-embedded-navigation";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) {
    return { payments: [] as Payment[], configured: false, ...getClientEnv() };
  }

  const st = new StellarTools({ api_key: shop.stellartools_api_key });
  const payments = await st.payments.list({ limit: 50 }).catch(() => [] as Payment[]);

  return { configured: true, payments, ...getClientEnv() };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const paymentId = (form.get("paymentId") as string)?.trim();
  const reason = (form.get("reason") as string)?.trim();

  if (!paymentId || !reason) {
    return { error: "Payment ID and reason are required", success: false };
  }

  const shop = await getShopByDomain(session.shop);

  if (!shop?.stellartools_api_key) {
    return { error: "StellarTools not configured", success: false };
  }

  try {
    const st = new StellarTools({ api_key: shop.stellartools_api_key });
    await st.refunds.create({ payment_id: paymentId, reason, metadata: null });
    return { error: null, success: true, refundedId: paymentId };
  } catch {
    return { error: "Failed to create refund — please try again", success: false };
  }
}

const STATUS_TONE: Record<string, string> = {
  confirmed: "success",
  pending: "warning",
  failed: "critical",
};

export default function Transactions() {
  const { payments, configured, stellartoolsDashboardUrl } = useLoaderData<typeof loader>();
  const settingsPath = useEmbeddedPath("/app/settings");
  const fetcher = useFetcher<typeof action>();
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const isSubmittingRefund = fetcher.state === "submitting";
  const refundSuccess = fetcher.data?.success && "refundedId" in (fetcher.data ?? {});
  const refundError = fetcher.data?.error;

  return (
    <s-page heading="Transactions">
      {refundSuccess && <s-banner heading="Refund submitted successfully" tone="success" dismissible />}
      {refundError && <s-banner heading={refundError} tone="critical" dismissible />}

      <s-section heading="Stellar payments">
        {!configured ? (
          <s-paragraph tone="subdued">
            Connect your StellarTools account in{" "}
            <s-link href={settingsPath} tone="auto">
              Settings
            </s-link>{" "}
            to see transactions here.
          </s-paragraph>
        ) : payments.length === 0 ? (
          <s-paragraph tone="subdued">No transactions yet.</s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header listSlot="labeled">Amount</s-table-header>
              <s-table-header listSlot="labeled">Asset</s-table-header>
              <s-table-header listSlot="labeled">Tx Hash</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
              <s-table-header listSlot="auxiliary">Actions</s-table-header>
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
                    {p.transaction_hash ? (
                      <s-link
                        href={`https://stellar.expert/explorer/public/tx/${p.transaction_hash}`}
                        tone="auto"
                        target="_blank"
                      >
                        {p.transaction_hash.slice(0, 10)}…
                      </s-link>
                    ) : (
                      "—"
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[p.status] ?? "info"}>{p.status}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {p.status === "confirmed" && refundingId !== p.id && (
                      <s-button variant="tertiary" tone="critical" onClick={() => setRefundingId(p.id)}>
                        Refund
                      </s-button>
                    )}
                    {refundingId === p.id && (
                      <fetcher.Form method="POST">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <s-stack direction="block" gap="base">
                          <s-text-field
                            label="Reason"
                            name="reason"
                            placeholder="e.g., Customer requested cancellation"
                            required
                          />
                          <s-button-group>
                            <s-button type="submit" variant="primary" tone="critical" loading={isSubmittingRefund}>
                              Confirm refund
                            </s-button>
                            <s-button type="button" onClick={() => setRefundingId(null)}>
                              Cancel
                            </s-button>
                          </s-button-group>
                        </s-stack>
                      </fetcher.Form>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section>
        <s-link href={`${stellartoolsDashboardUrl}/transactions`} tone="auto" target="_blank">
          View all transactions in StellarTools ↗
        </s-link>
      </s-section>
    </s-page>
  );
}
