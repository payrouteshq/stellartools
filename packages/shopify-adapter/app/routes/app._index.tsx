import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useState } from "react";

interface SessionRow {
  organizationId: string | null;
  scope: string | null;
}

async function fetchConnection(shop: string) {
  const apiUrl = process.env.STELLAR_TOOLS_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!apiUrl || !secret) return { connected: false, organizationId: null, scope: null };
  try {
    const res = await fetch(`${apiUrl}/shopify/sessions?shop=${encodeURIComponent(shop)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return { connected: false, organizationId: null, scope: null };
    const sessions: SessionRow[] = await res.json();
    const linked = sessions.find((s) => s.organizationId != null);
    return {
      connected: !!linked,
      organizationId: linked?.organizationId ?? null,
      scope: linked?.scope ?? null,
    };
  } catch {
    return { connected: false, organizationId: null, scope: null };
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const conn = await fetchConnection(session.shop);
  return {
    shop: session.shop,
    connected: conn.connected,
    organizationId: conn.organizationId,
    scope: conn.scope,
    webhookUrl: `${process.env.SHOPIFY_APP_URL ?? ""}/webhooks`,
    apiUrl: process.env.STELLAR_TOOLS_API_URL ?? "",
    dashboardUrl: process.env.STELLAR_TOOLS_DASHBOARD_URL ?? "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent") as string;
  const apiUrl = process.env.STELLAR_TOOLS_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!apiUrl || !secret) return { error: "Server configuration error." };

  if (intent === "disconnect") {
    await fetch(`${apiUrl}/shopify/connect`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ shop: session.shop }),
    });
    return { ok: true };
  }

  if (intent === "update") {
    const apiKey = (fd.get("apiKey") as string | null)?.trim() ?? "";
    if (!apiKey) return { error: "API key is required." };
    const res = await fetch(`${apiUrl}/shopify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ shop: session.shop, apiKey }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { error: (body.error as string) ?? "Invalid API key. Try again." };
    }
    return { ok: true };
  }

  return null;
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border, #e3e3e3)",
  borderRadius: "8px",
  padding: "8px 12px",
  marginBottom: "4px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--p-color-text-secondary, #6d7175)",
  marginBottom: "4px",
  marginTop: "12px",
};

const codeStyle: React.CSSProperties = {
  flex: 1,
  fontSize: "13px",
  fontFamily: "monospace",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--p-color-text, #202223)",
};

const copyBtnStyle = (copied: boolean): React.CSSProperties => ({
  flexShrink: 0,
  fontSize: "12px",
  padding: "2px 8px",
  cursor: "pointer",
  border: "1px solid var(--p-color-border, #e3e3e3)",
  borderRadius: "6px",
  background: copied ? "var(--p-color-bg-success-subdued, #e3f1df)" : "transparent",
  color: copied ? "var(--p-color-text-success, #2a6b2a)" : "var(--p-color-text, #202223)",
  transition: "all 0.15s",
});

function CopyRow({
  label,
  value,
  masked,
  hint,
}: {
  label: string;
  value: string;
  masked?: boolean;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = masked ? "•".repeat(Math.min(value.length, 36)) : value;

  const copy = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p style={labelStyle}>{label}</p>
      <div style={rowStyle}>
        <code style={codeStyle}>{display}</code>
        <button type="button" style={copyBtnStyle(copied)} onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {hint && (
        <p style={{ fontSize: "12px", color: "var(--p-color-text-secondary, #6d7175)", marginTop: "2px" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function HomePage() {
  const { shop, connected, organizationId, scope, webhookUrl, apiUrl, dashboardUrl } =
    useLoaderData<typeof loader>();

  const disconnectFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const updateFetcher = useFetcher<{ ok?: boolean; error?: string }>();

  const [showUpdate, setShowUpdate] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");

  const isDisconnecting = disconnectFetcher.state === "submitting";
  const isUpdating = updateFetcher.state === "submitting";
  const scopes = scope?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  return (
    <s-page heading="StellarTools Payments">
      {/* ── Main section ── */}
      <s-section heading={connected ? "Store connected" : "Connect your store"}>
        {connected ? (
          <>
            <s-paragraph>
              <strong>{shop}</strong> is linked to StellarTools. Your customers
              can pay with USDC, XLM, EURC and other Stellar assets at checkout.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button href={`${dashboardUrl}/transactions`} target="_blank" variant="primary">
                View payments
              </s-button>
            </s-stack>
          </>
        ) : (
          <>
            <s-paragraph>
              Your store is not yet linked to a StellarTools organization. Get
              your API key from the StellarTools dashboard and follow the setup
              steps to start accepting Stellar payments.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button href="/app/additional" variant="primary">
                Get started
              </s-button>
              <s-button href={`${dashboardUrl}/marketplace`} target="_blank" variant="secondary">
                Open dashboard
              </s-button>
            </s-stack>
          </>
        )}
      </s-section>

      {/* ── Connection details (only when connected) ── */}
      {connected && (
        <s-section heading="Connection details">
          <CopyRow
            label="Organization ID"
            value={organizationId ?? ""}
            hint="Reference this ID when contacting StellarTools support."
          />
          <CopyRow
            label="StellarTools API URL"
            value={apiUrl}
            hint="The endpoint your store calls to process Stellar payments."
          />
          <CopyRow
            label="Webhook endpoint"
            value={webhookUrl}
            hint="Shopify sends lifecycle events (install, uninstall, scope changes) to this URL."
          />

          {scopes.length > 0 && (
            <div>
              <p style={labelStyle}>Active scopes</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                {scopes.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "var(--p-color-bg-fill-info-secondary, #eaf4fb)",
                      color: "var(--p-color-text-info, #1b5e8c)",
                      fontFamily: "monospace",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </s-section>
      )}

      {/* ── Manage connection (only when connected) ── */}
      {connected && (
        <s-section heading="Manage connection">
          {/* Update API key */}
          {!showUpdate ? (
            <div style={{ marginBottom: "16px" }}>
              <s-paragraph>
                Linked to the wrong organization? Update your API key to
                reconnect this store to a different StellarTools account.
              </s-paragraph>
              <s-button variant="secondary" onClick={() => setShowUpdate(true)}>
                Update API key
              </s-button>
            </div>
          ) : (
            <div style={{ marginBottom: "16px" }}>
              <p style={labelStyle}>New StellarTools API key</p>
              <input
                type="password"
                placeholder="st_key_..."
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                autoComplete="off"
                style={{
                  display: "block",
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
                  marginBottom: "10px",
                }}
              />
              {updateFetcher.data?.error && (
                <s-banner tone="critical">
                  <s-paragraph>{updateFetcher.data.error}</s-paragraph>
                </s-banner>
              )}
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="primary"
                  disabled={isUpdating || !newApiKey ? true : undefined}
                  onClick={() => {
                    if (!newApiKey) return;
                    updateFetcher.submit(
                      { intent: "update", apiKey: newApiKey },
                      { method: "post" }
                    );
                    setShowUpdate(false);
                    setNewApiKey("");
                  }}
                >
                  {isUpdating ? "Saving..." : "Save"}
                </s-button>
                <s-button variant="secondary" onClick={() => { setShowUpdate(false); setNewApiKey(""); }}>
                  Cancel
                </s-button>
              </s-stack>
            </div>
          )}

          {/* Disconnect */}
          <div
            style={{
              borderTop: "1px solid var(--p-color-border-critical-subdued, #ffc9b0)",
              paddingTop: "16px",
              marginTop: "4px",
            }}
          >
            {!confirmDisconnect ? (
              <>
                <s-paragraph>
                  Disconnecting removes the link between this store and your
                  StellarTools organization. Payments will stop working until
                  you reconnect.
                </s-paragraph>
                <s-button
                  variant="secondary"
                  tone="critical"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect store
                </s-button>
              </>
            ) : (
              <>
                <s-banner tone="warning">
                  <s-paragraph>
                    <strong>Disconnect this store?</strong> This will unlink{" "}
                    <strong>{shop}</strong> from StellarTools. Existing
                    transactions are not affected but new payments will stop
                    processing immediately.
                  </s-paragraph>
                </s-banner>
                <div style={{ marginTop: "12px" }}>
                <s-stack direction="inline" gap="base">
                  <s-button
                    variant="primary"
                    tone="critical"
                    disabled={isDisconnecting ? true : undefined}
                    onClick={() =>
                      disconnectFetcher.submit(
                        { intent: "disconnect" },
                        { method: "post" }
                      )
                    }
                  >
                    {isDisconnecting ? "Disconnecting..." : "Yes, disconnect"}
                  </s-button>
                  <s-button variant="secondary" onClick={() => setConfirmDisconnect(false)}>
                    Cancel
                  </s-button>
                </s-stack>
                </div>
              </>
            )}
          </div>
        </s-section>
      )}

      {/* ── Aside: How it works ── */}
      <s-section slot="aside" heading="How it works">
        <s-paragraph>
          <strong>1. Install</strong>: Merchants install this app from the
          Shopify App Store.
        </s-paragraph>
        <s-paragraph>
          <strong>2. Connect</strong>: Link your StellarTools account using your
          API key.
        </s-paragraph>
        <s-paragraph>
          <strong>3. Accept payments</strong>: Shoppers choose StellarTools at
          checkout and pay with any Stellar asset.
        </s-paragraph>
        <s-paragraph>
          <strong>4. Settle instantly</strong>: Funds arrive in your Stellar
          wallet in under 5 seconds.
        </s-paragraph>
      </s-section>

      {/* ── Aside: Resources ── */}
      <s-section slot="aside" heading="Resources">
        <s-unordered-list>
          <s-list-item>
            <s-link href={`${dashboardUrl}/transactions`} target="_blank">
              Payment history
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href={`${dashboardUrl}/marketplace`} target="_blank">
              Marketplace
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://stellartools.dev/docs" target="_blank">
              Documentation
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://stellartools.dev/support" target="_blank">
              Support
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
