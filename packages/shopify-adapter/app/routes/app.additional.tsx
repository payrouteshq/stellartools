import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const dashboardUrl = process.env.STELLAR_TOOLS_DASHBOARD_URL ?? "";
  return { shop: session.shop, dashboardUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const apiKey = (formData.get("apiKey") as string | null)?.trim() ?? "";

  if (!apiKey) return { error: "API key is required." };

  const apiUrl = process.env.STELLAR_TOOLS_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!apiUrl || !secret) return { error: "Server configuration error. Contact support." };

  const res = await fetch(`${apiUrl}/shopify/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ shop: session.shop, apiKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { error: (body.error as string) ?? "Failed to connect. Check your API key and try again." };
  }

  // Mark this payments app as ready so it can appear at checkout
  await fetch(`https://${session.shop}/admin/api/2025-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `mutation PaymentsAppConfigure($ready: Boolean!) {
        paymentsAppConfigure(ready: $ready) {
          userErrors { field message }
        }
      }`,
      variables: { ready: true },
    }),
  }).catch(() => {});

  // Redirect merchant to activate the payment method in Shopify admin
  const shopifyApiKey = process.env.SHOPIFY_API_KEY ?? "";
  return redirect(
    `https://${session.shop}/services/payments_partners/gateways/${shopifyApiKey}/settings`
  );
};

export default function GettingStartedPage() {
  const { dashboardUrl, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string }>();
  const [apiKey, setApiKey] = useState("");
  const isSubmitting = fetcher.state === "submitting";

  return (
    <s-page heading="Getting started">
      <s-section heading="1. Create a StellarTools account">
        <s-paragraph>
          If you haven&apos;t already, sign up at StellarTools and create an
          organization. Your organization holds your API keys, payment settings,
          and transaction history.
        </s-paragraph>
        <s-button href={`${dashboardUrl}/register`} target="_blank" variant="primary">
          Create account
        </s-button>
      </s-section>

      <s-section heading="2. Copy your API key">
        <s-paragraph>
          In the StellarTools dashboard, go to{" "}
          <s-link href={`${dashboardUrl}/api-keys`} target="_blank">
            API Keys
          </s-link>{" "}
          and create a new key. Copy the key — it starts with{" "}
          <code>st_key_</code>.
        </s-paragraph>
      </s-section>

      <s-section heading="3. Connect your store">
        <s-paragraph>
          Paste your API key below to link <strong>{shop}</strong> to your
          StellarTools organization and start accepting Stellar payments.
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label
              htmlFor="apiKey"
              style={{ fontSize: "14px", fontWeight: 500, color: "var(--p-color-text)" }}
            >
              StellarTools API key
            </label>
            <input
              id="apiKey"
              type="password"
              placeholder="st_key_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                fontFamily: "monospace",
                border: "1px solid var(--p-color-border, #c9cccf)",
                borderRadius: "8px",
                outline: "none",
                background: "var(--p-color-bg-surface, #fff)",
                color: "var(--p-color-text, #202223)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {fetcher.data?.error && (
            <s-banner tone="critical" heading="Connection failed">
              <s-paragraph>{fetcher.data.error}</s-paragraph>
            </s-banner>
          )}

          <div>
            <s-button
              variant="primary"
              disabled={isSubmitting || !apiKey ? true : undefined}
              onClick={() => {
                if (!apiKey) return;
                fetcher.submit({ apiKey }, { method: "post" });
              }}
            >
              {isSubmitting ? "Connecting..." : "Connect store"}
            </s-button>
          </div>
        </div>
      </s-section>

      <s-section heading="4. Test a payment">
        <s-paragraph>
          Once connected, switch your StellarTools organization to{" "}
          <strong>Testnet</strong> and place a test order in your Shopify store.
          Use a Stellar testnet wallet to pay and verify the flow end to end.
        </s-paragraph>
        <s-button
          href={`${dashboardUrl}/transactions`}
          target="_blank"
          variant="secondary"
        >
          View transactions
        </s-button>
      </s-section>

      <s-section slot="aside" heading="Need help?">
        <s-unordered-list>
          <s-list-item>
            <s-link href="https://stellartools.dev/docs" target="_blank">
              Documentation
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://stellartools.dev/support" target="_blank">
              Contact support
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://discord.gg/stellartools" target="_blank">
              Join the Discord
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
