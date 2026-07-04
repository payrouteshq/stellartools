import { useState } from "react";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Network, StellarTools, WebhookEventType } from "@stellartools/core";
import { getShopByDomain, updateShopSettings, updateShopWebhook } from "~/db.server";
import { getAppUrl, getClientEnv } from "~/env.server";
import { configurePaymentsApp } from "~/payments-apps.server";
import { authenticate } from "~/shopify.server";

// ─── Webhook Synchronization Helper ──────────────────────────────────────────

async function syncStellarWebhook(params: {
  st: StellarTools;
  shop: any;
  apiKey: string;
  appUrl: string | null;
  shopDomain: string;
}) {
  const { st, shop, apiKey, appUrl, shopDomain } = params;

  if (!appUrl) {
    return "Settings saved, but webhook was not registered — set SHOPIFY_APP_URL in .env to your tunnel URL.";
  }

  const webhookUrl = `${appUrl}/webhooks/stellartools?shop=${encodeURIComponent(shopDomain)}`;
  const webhookEvents = [
    "payment.confirmed",
    "payment.failed",
    "refund.succeeded",
    "refund.failed",
  ] as Array<WebhookEventType>;

  let webhookId = shop?.stellartools_webhook_id;
  let webhookSecret = shop?.stellartools_webhook_secret;

  try {
    // SCENARIO 1: Key changed — Disable old, create new
    if (webhookId && shop.stellartools_api_key !== apiKey) {
      const oldSt = new StellarTools({ api_key: shop.stellartools_api_key });
      await oldSt.webhooks.update(webhookId, { is_disabled: true }).catch(() => {});

      console.log("disabling webhook", { webhookId });

      const created = await st.webhooks.create({
        name: `Shopify — ${shopDomain}`,
        url: webhookUrl,
        events: webhookEvents,
      });
      webhookId = created.id;
      webhookSecret = created.secret;
      console.log("created webhook", { created });
    }
    // SCENARIO 2: No webhook exists — Create fresh
    else if (!webhookId) {
      const created = await st.webhooks.create({
        name: `Shopify — ${shopDomain}`,
        url: webhookUrl,
        events: webhookEvents,
      });
      console.log("created webhook", { created });
      webhookId = created.id;
      webhookSecret = created.secret;
    }
    // SCENARIO 3: Same key — Update URL/Status
    else {
      const updated = await st.webhooks.update(webhookId, { url: webhookUrl, is_disabled: false });
      webhookSecret = updated.secret;
      console.log("updated webhook", { updated });
    }

    await updateShopWebhook(shopDomain, webhookId, webhookSecret);
    return null; // Success
  } catch (error) {
    return error instanceof Error ? `Webhook sync failed: ${error.message}` : "Webhook sync failed.";
  }
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  return { shop, ...getClientEnv() };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const apiKey = (form.get("apiKey") as string)?.trim();

  if (!apiKey) return { error: "API key is required", success: false, environment: null };

  const st = new StellarTools({ api_key: apiKey });

  // 1. Validate Account & Network
  let network: Network;
  try {
    const response = await st.balance.retrieve();
    network = response.network;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid API key", success: false, environment: null };
  }

  // 2. Persist Settings
  await updateShopSettings(session.shop, apiKey, network);
  const shop = await getShopByDomain(session.shop);

  // 3. Sync Webhooks (Functional & Clean)
  const webhookWarning = await syncStellarWebhook({
    st,
    shop,
    apiKey,
    appUrl: getAppUrl(),
    shopDomain: session.shop,
  });

  // 4. Finalize Payments App Config
  await configurePaymentsApp(session.shop, session.accessToken!).catch(console.error);

  return { success: true, environment: network, error: webhookWarning };
}

export default function Settings() {
  const { shop, shopifyApiKey, stellartoolsDashboardUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [apiKey, setApiKey] = useState(shop?.stellartools_api_key ?? "");

  // Detect if the specific settings form is currently submitting
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formMethod === "POST" &&
    navigation.location?.pathname === "/app/settings";

  const isConnected = !!shop?.stellartools_api_key;

  const handleSave = () => {
    const fd = new FormData();
    fd.set("apiKey", apiKey.trim());
    submit(fd, { method: "POST" });
  };

  const connectionLabel = isConnected ? "Connected" : "Not configured";
  const currentEnv = actionData?.environment ?? shop?.environment ?? "testnet";
  const gatewayUrl = `https://${shop?.shop_domain}/services/payments_partners/gateways/${shopifyApiKey}/settings`;

  return (
    <s-page heading="Settings">
      {actionData?.success && (
        <s-banner heading={`Settings saved — connected to StellarTools (${currentEnv})`} tone="success" dismissible>
          <s-link href={gatewayUrl} tone="auto" target="_blank">
            Activate Stellar Pay in your store's payment settings ↗
          </s-link>
        </s-banner>
      )}

      {actionData?.error && <s-banner heading={actionData.error} tone="critical" dismissible />}

      <s-section heading="Connection status">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={isConnected ? "success" : "warning"}>{connectionLabel}</s-badge>
          {isConnected && (
            <s-text color="subdued">
              Key ending in ···{shop.stellartools_api_key!.slice(-4)} · {shop.environment}
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="StellarTools API key">
        <s-paragraph tone="subdued">
          Get your key from StellarTools → Settings → API Keys. The network (testnet or mainnet) is determined by where
          you created the key{" "}
          <s-link href={`${stellartoolsDashboardUrl}/api-keys`} tone="auto" target="_blank">
            Open StellarTools ↗
          </s-link>
        </s-paragraph>

        <s-form
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <s-password-field
            label="API key"
            name="apiKey"
            value={apiKey}
            placeholder="st_live_... or st_test_..."
            autocomplete="off"
            onInput={(e: React.FormEvent<HTMLInputElement>) => setApiKey(e.currentTarget.value)}
          />
        </s-form>
      </s-section>

      <s-section heading="How it works">
        <s-ordered-list>
          <s-list-item>Customers add items to their cart and click "Pay with Stellar"</s-list-item>
          <s-list-item>They're redirected to a StellarTools hosted checkout page</s-list-item>
          <s-list-item>Payment is made in USDC, EURC, XLM, or other Stellar assets</s-list-item>
          <s-list-item>You see the payment appear in the Transactions tab</s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section>
        <s-button variant="primary" {...(isSaving ? { loading: true } : {})} onClick={handleSave}>
          Save settings
        </s-button>
      </s-section>
    </s-page>
  );
}
