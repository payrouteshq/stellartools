# StellarTools WooCommerce Plugin

WooCommerce payment gateway for StellarTools hosted checkout.

## Prerequisites

- WordPress 6.0+
- WooCommerce 8.0+
- A StellarTools account with an API key and webhook secret

## Install the plugin

Copy or symlink this folder into your WordPress plugins directory:

```
wp-content/plugins/stellartools
```

The main plugin file is `stellartools_woocommerce.php`.

In WordPress admin: Plugins → activate StellarTools.

## Configure

WooCommerce → Settings → Payments → StellarTools → Manage.

Set:

- API Key — from the StellarTools dashboard
- StellarTools API URL — `https://api.stellartools.dev` (or your local API, e.g. `http://api.localhost:3000`)
- Webhook Signing Secret — from your webhook in the StellarTools dashboard

Copy the webhook URL shown in the settings page and register it in the StellarTools dashboard. Enable at least `payment.confirmed` and `payment.failed`.

Enable the gateway and save.

## Local development

Run your WordPress site and the StellarTools API as you normally would.

Point the plugin API URL at your local API if needed.

Webhooks need a public URL that reaches your WordPress site. Use a tunnel (e.g. ngrok or Cloudflare) if WordPress is only on localhost.

Turn on Debug Logging in the gateway settings while testing. Logs appear under WooCommerce → Status → Logs.

## Test checkout

Add a product, go to checkout, choose StellarTools, and place the order. You should be redirected to the StellarTools hosted checkout page.
