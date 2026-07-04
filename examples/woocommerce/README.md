# WooCommerce test store

Local WordPress + WooCommerce store with the StellarTools plugin mounted from the repo.

## Start

From the repo root:

```
docker compose -f examples/woocommerce/docker-compose.yml up -d
```

Open http://localhost:8080

## First-time WordPress setup

1. Pick a site title, admin user, and password
2. Log in to wp-admin

## Install WooCommerce

Plugins → Add New → search WooCommerce → Install → Activate

The StellarTools plugin should already appear under Plugins (mounted from `packages/woocommerce-adapter`). Activate it.

Docs: https://docs.stellartools.dev/integrations/woocommerce

## Configure StellarTools

WooCommerce → Settings → Payments → StellarTools → Manage

- API Key — your `sk_test_` key
- StellarTools API URL — `https://api.stellartools.dev` or `http://host.docker.internal:3000` if running the API locally
- Webhook Signing Secret — from your StellarTools webhook

Register the webhook URL shown in settings (e.g. `http://localhost:8080/wp-json/stellartools/v1/webhook`) in the StellarTools dashboard.

For webhooks to reach a local store, expose port 8080 with a tunnel (ngrok, Cloudflare, etc.) and use that public URL in the dashboard.

Turn on Debug Logging while testing. Logs: WooCommerce → Status → Logs → stellartools-gateway.

## Test checkout

1. WooCommerce → add a simple product
2. Storefront → add to cart → checkout
3. Choose StellarTools → place order
4. Complete payment on the StellarTools hosted checkout page

## Stop

```
docker compose -f examples/woocommerce/docker-compose.yml down
```

Data is kept in Docker volumes. Add `-v` to wipe everything.
