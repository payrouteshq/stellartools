# GoHighLevel — StellarTools Marketplace App

The backend for StellarTools' [GoHighLevel Custom Payments Integration](https://help.gohighlevel.com/support/solutions/articles/155000002620-how-to-build-a-custom-payments-integration-on-the-platform). GoHighLevel has no plugin file or SDK to install — it's fully SaaS-hosted, so merchants never run their own server. This app is deployed once, permanently, and HighLevel calls it directly for every payment operation.

All of the UI lives in `apps/web` — the checkout iframe, the config page, the post-connect
confirmation. This app is deliberately UI-light: its own `/` page is the one exception, a single
"Connect GoHighLevel" button loaded inside a StellarTools dashboard (same mechanism as the
`loops`/`resend`/`posthog` marketplace apps — an `st_token` handed in via query param). Clicking
it signs that token into GoHighLevel's OAuth `state` and redirects into HighLevel's own consent
screen; `/install` verifies the state and auto-provisions the location on return. No API key to
find or paste, no secret shared between the two apps beyond one internal-call secret.

## What's here

- `/` — the "Connect GoHighLevel" button (StellarTools-embedded).
- `/api/connect` — signs the state, redirects into HighLevel's OAuth.
- `/install` — OAuth callback: exchanges the code, registers the provider config with HighLevel,
  auto-provisions if `state` is present, otherwise sends the merchant to apps/web's `/ghl/config`.
- `/api/ghl/query` — the `queryUrl` HighLevel calls for verify/charge/refund/subscriptions.
- `/api/ghl/lifecycle` — HighLevel's install/uninstall webhook.
- `/api/stellar/webhook/[ghlSecret]` — StellarTools → here → HighLevel. One URL per (location,
  mode) credential; the path segment is how this multi-tenant endpoint knows which org's signing
  secret to verify a given delivery with.
- `/api/checkout` — creates a StellarTools checkout for the iframe in apps/web. Called
  server-to-server from there (via its `/api/ghl/checkout` proxy), never from a browser.
- `/api/connect-stellar` — saves a StellarTools key for a location. Called server-to-server from
  apps/web's `/ghl/config` page.
- `/api/cron/renew-subscriptions` (hourly) — see below.

Both server-to-server endpoints check an `x-internal-secret` header against
`GHL_INTERNAL_API_SECRET`, shared with apps/web.

## Subscriptions and saved cards

StellarTools payments are customer-signed on-chain transactions — there's no stored,
merchant-chargeable payment method. `list_payment_methods` and `charge_payment` reflect that
directly. `create_subscription` stores a schedule instead of charging immediately;
`/api/cron/renew-subscriptions` creates a fresh checkout for each due schedule, and the
StellarTools webhook route advances the schedule and reports `subscription.charged` once the
customer pays. Notifying the customer about that new checkout link is deployment-specific and
marked as an extension point in the cron route.

Refunds are full-refund only — a request for less than the original charge is rejected with a
clear message rather than over-refunding.

## Setup

1. Create a Marketplace app at `marketplace.gohighlevel.com`: scopes from `lib/ghl.ts`'s
   `GHL_REQUIRED_SCOPES`, redirect URL `<APP_URL>/install`, install/uninstall webhook at
   `<APP_URL>/api/ghl/lifecycle`, and a Payment Provider entry (queryUrl `<APP_URL>/api/ghl/query`,
   paymentsUrl `<STELLARTOOLS_WEB_APP_URL>/ghl/checkout`).

   The provider registration, Connect Config, and capabilities endpoint paths in `lib/ghl.ts`
   follow HighLevel's documented `/payments/custom-provider/*` namespace but aren't published in
   machine-readable form — verify them against your Marketplace developer portal before going live.

2. Copy `.env.example` to `.env` and fill it in. Set `GHL_INTERNAL_API_SECRET` to the same value
   apps/web uses.

3. Apply the schema: `psql "$GHL_APP_DATABASE_URL" -f db/init.sql`

4. `pnpm install && pnpm dev` (port 3002).

## Testing locally

GoHighLevel's servers need a real HTTPS URL to reach `/install` and `/api/ghl/query`, so
`localhost` alone isn't enough for the full flow — but most of this is testable without a
GoHighLevel account at all:

**Without a GHL account:**

1. Run a local Postgres, apply `db/init.sql`, start this app (`pnpm dev`, port 3002) and apps/web
   (port 3000) with matching `.env` files (`GHL_INTERNAL_API_SECRET` must match on both).
2. Manually insert a `ghl_locations` row (a real one only ever gets created by `/install`) so the
   rest of the flow has something to attach to:
   ```sql
   insert into ghl_locations (location_id, access_token, refresh_token, token_expires_at)
   values ('test-location', 'x', 'x', now() + interval '1 hour');
   ```
3. Open `http://localhost:3000/ghl/config?locationId=test-location` and connect a real
   StellarTools testnet key — this exercises `connectStellarAccount`, the webhook registration,
   and (mocked) Connect Config call end to end.
4. `curl localhost:3002/api/ghl/query` with a hand-built `verify`/`charge_payment`/etc. JSON body
   (the `apiKey` field is the `ghl_secret` — check it in `ghl_credentials` — since that's how the
   route resolves which org to use) to exercise the dispatcher directly.
5. Open `http://localhost:3000/ghl/checkout` in a browser, then in devtools run
   `window.postMessage({type: "payment_initiate_props", publishableKey: "pk_test_test-location", amount: 10, currency: "USD", mode: "payment", contact: {id: "c1"}, transactionId: "t1", locationId: "test-location"}, "*")`
   to simulate what GoHighLevel sends — this creates a real checkout and renders the real checkout UI.

**With a GHL account (full OAuth + webhook round trip):** create a **Private** distribution app
in the HighLevel developer portal (no review needed — see the docs page), point its redirect
URL/queryUrl/install-webhook at a tunnel (`ngrok http 3002`, or the `cloudflared` setup already
in this repo's `docker-compose.yml`) fronting this app, point `paymentsUrl` at wherever apps/web
is actually reachable (a deployed instance is easiest — you only need to tunnel _this_ app while
iterating on it), and install it on a test sub-account.

## Structure

```
lib/
  ghl-types.ts   wire types for the queryUrl/webhook contract
  ghl.ts         HighLevel API client, queryUrl dispatcher, OAuth/state signing
app/
  actions/
    db.ts        locations, credentials, checkouts, schedules (pg)
    stellar.ts   connectStellarAccount — validate, save, register webhook
  api/...        each route is `apiHandler(...)` from `@stellartools/core` — schema-validated
                 body, thrown `HandlerError` for structured error responses
db/init.sql      schema
```
