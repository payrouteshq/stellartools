# StellarTools WooCommerce Plugin

WooCommerce payment gateway for StellarTools hosted checkout.

Full install and configuration guide: https://docs.stellartools.dev/integrations/woocommerce

Download (sign in required): https://dashboard.stellartools.dev/~api/integrations/woocommerce/download

Local test store: ../../examples/woocommerce/README.md

## What's included

- Classic WooCommerce checkout (shortcode checkout)
- WooCommerce Block Checkout (Cart/Checkout blocks)

There is no standalone WordPress Gutenberg block yet (e.g. a pay button outside WooCommerce checkout).

## Install

Copy this folder into `wp-content/plugins/stellartools` and activate in WordPress.

Requires WordPress 6.0+ and WooCommerce 8.0+.

## Configure

WooCommerce → Settings → Payments → StellarTools

Set your API key, API URL, and webhook signing secret. Register the webhook URL from the settings page in the StellarTools dashboard (`/index.php?rest_route=/stellartools/v1/webhook`).

See the docs for screenshots and field-by-field setup: https://docs.stellartools.dev/integrations/woocommerce
