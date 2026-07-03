import { useRef } from "react";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { StellarTools } from "@stellartools/core";
import { getShopByDomain, updateShopSettings, updateShopWebhook } from "~/db.server";
import { configurePaymentsApp } from "~/payments-apps.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  return { shop };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const apiKey = (form.get("apiKey") as string)?.trim();

  if (!apiKey) {
    return { error: "API key is required", success: false, environment: null as "testnet" | "mainnet" | null };
  }

  // Validate the key first
  const st = new StellarTools({ api_key: apiKey });

  const balance = await st.balance.retrieve();

  if ("error" in balance) {
    return {
      error: balance.error,
      success: false,
      environment: null,
    };
  }

  // Derive network from key prefix — Balance type doesn't expose network
  const network: "testnet" | "mainnet" = apiKey.startsWith("st_live_") ? "mainnet" : "testnet";
  await updateShopSettings(session.shop, apiKey, network);

  // Register or update the StellarTools webhook so payment.confirmed events reach this app.
  const shop = await getShopByDomain(session.shop);
  const webhookUrl = `${process.env.SHOPIFY_APP_URL}/webhooks/stellartools?shop=${session.shop}`;

  let webhookId = shop?.stellartools_webhook_id ?? null;
  let webhookSecret = shop?.stellartools_webhook_secret ?? null;

  if (shop?.stellartools_webhook_id) {
    if (shop.stellartools_api_key && shop.stellartools_api_key !== apiKey) {
      // API key changed — disable the webhook on the old account, create fresh on the new one
      const oldSt = new StellarTools({ api_key: shop.stellartools_api_key });
      await oldSt.webhooks.update(shop.stellartools_webhook_id, { is_disabled: true }).catch(() => {});

      const created = await st.webhooks
        .create({
          name: `Shopify — ${session.shop}`,
          url: webhookUrl,
          events: ["payment.confirmed", "payment.failed", "refund.succeeded", "refund.failed"],
        })
        .catch(() => null);
      const ok = created && !("error" in created);
      webhookId = ok ? created.id : null;
      webhookSecret = ok ? created.secret : null;
    } else {
      // Same API key — update the URL (ngrok may have changed) and ensure it's enabled
      await st.webhooks.update(shop.stellartools_webhook_id, { url: webhookUrl, is_disabled: false }).catch(() => {});
    }
  } else {
    // First time saving — create the webhook
    const created = await st.webhooks
      .create({
        name: `Shopify — ${session.shop}`,
        url: webhookUrl,
        events: ["payment.confirmed", "payment.failed", "refund.succeeded", "refund.failed"],
      })
      .catch(() => null);
    const ok = created && !("error" in created);
    webhookId = ok ? created.id : null;
    webhookSecret = ok ? created.secret : null;
  }

  await updateShopWebhook(session.shop, webhookId, webhookSecret);

  // Tell Shopify the payment extension is ready to accept payments
  await configurePaymentsApp(session.shop, session.accessToken!).catch(() => {});

  return { success: true, environment: network, error: null as string | null };
}

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);

  const isSaving = navigation.state === "submitting";
  const isConnected = !!shop?.stellartools_api_key;

  const handleSave = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    submit(fd, { method: "POST" });
  };

  return (
    <s-page heading="Settings">
      {actionData?.success && (
        <s-banner
          heading={`Settings saved — connected to StellarTools (${actionData.environment ?? shop?.environment ?? "testnet"})`}
          tone="success"
          dismissible
        >
          <s-link
            href={`https://${shop?.shop_domain}/services/payments_partners/gateways/${process.env.SHOPIFY_API_KEY}/settings`}
            tone="auto"
            target="_blank"
          >
            Activate Stellar Pay in your store's payment settings ↗
          </s-link>
        </s-banner>
      )}
      {actionData?.error && <s-banner heading={actionData.error} tone="critical" dismissible />}

      <s-section heading="Connection status">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={isConnected ? "success" : "warning"}>{isConnected ? "Connected" : "Not configured"}</s-badge>
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
          you created the key — no separate choice needed.{" "}
          <s-link href={`${process.env.STELLARTOOLS_DASHBOARD_URL!}/api-keys`} tone="auto" target="_blank">
            Open StellarTools ↗
          </s-link>
        </s-paragraph>

        <form ref={formRef}>
          <s-password-field
            label="API key"
            name="apiKey"
            defaultValue={shop?.stellartools_api_key ?? ""}
            placeholder="st_live_... or st_test_..."
            autocomplete="off"
          />
        </form>
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
        <s-button variant="primary" loading={isSaving} onClick={handleSave}>
          Save settings
        </s-button>
      </s-section>
    </s-page>
  );
}
