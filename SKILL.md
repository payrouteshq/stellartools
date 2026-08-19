---
name: stellartools-payments
description: >
  Use when integrating StellarTools payments into an app: accepting Stellar-native crypto or
  fiat payments, creating hosted checkouts, running Soroban-enforced subscription billing,
  verifying webhook deliveries, or connecting an agent to a StellarTools account through its
  MCP server. Also use when users mention StellarTools, Stripe-like payment infrastructure on
  Stellar, or Soroban subscription billing — even if they don't mention StellarTools by name.
license: MIT
compatibility: Designed for Claude Code and compatible AI coding assistants. Requires a StellarTools API key (test or live) for any live SDK, REST, or MCP calls; reading this skill alone needs no network access.
metadata:
  author: Payroutes
  version: "1.0"
---

# Integrating StellarTools Payments

Use this when a task involves accepting payments, running subscriptions, or handling webhooks with StellarTools — an open-source payment platform on the Stellar blockchain, via the `@stellartools/core` SDK. Everything below was checked against the actual SDK source, not just the marketing docs, because the two have drifted apart in places (noted below). When in doubt, the source is ground truth.

## What it is

StellarTools accepts crypto payments on Stellar, runs subscription billing enforced by a Soroban smart contract rather than just app code, and settles in seconds for fractions of a cent. It also handles payouts to local currencies. One API key is all the configuration there is — no separate base URL to set, since the key itself encodes whether it's testnet or mainnet.

## Setup and auth

Install `@stellartools/core` and create a client with a single field: the API key. Get one from the [dashboard's API Keys page](https://dashboard.stellartools.dev/api-keys) — a test key while building, a live key when going live, and nothing else about the integration changes between the two. The key only works server-side; it should never reach the browser. Full details: [Authentication](https://docs.stellartools.dev/api-reference/authentication).

The client gives you one entry point per resource: customers, products, checkouts, subscriptions, payments, refunds, webhooks, balance, and app installations.

## The core flow: sell something

1. Create a product once — the thing being sold — and reuse it across checkouts.
2. Create a checkout for that product, or a direct checkout for a one-off amount with no product involved.
3. Send the customer to the checkout's payment link.
4. Fulfill the order when the payment-confirmed webhook fires — not on the redirect, which happens before the payment is actually confirmed on-chain. Treating the redirect as proof of payment risks fulfilling something that was never confirmed, or that failed.

### Products

Creating a product needs a name, a type (one-time or subscription — fixed forever once chosen), a price in the smallest unit of the currency, the currency itself, and, for subscriptions, a billing period: daily, weekly, monthly, yearly, or a custom interval. See [Products](https://docs.stellartools.dev/products) for how the two billing models differ, and [API Reference: Products](https://docs.stellartools.dev/api-reference/products) for the full field list.

### Checkouts — product-based

Creating a checkout needs the product and a way to identify the customer — either an existing customer id or just their email — plus a redirect URL. It comes back with a payment link. Adding a trial length when creating a subscription checkout gives the customer a free trial before the first charge.

### Checkouts — direct amount, no product

For a one-off charge that doesn't need a reusable product, create a checkout with just an amount and a currency instead of a product.

### Checking a checkout later

Fetching a checkout by id returns its status: open, completed, expired, or failed. Full field list: [API Reference: Checkouts](https://docs.stellartools.dev/api-reference/checkouts).

## Customers

Creating a customer needs an email and a name, with phone optional. The id that comes back is what you reference this customer by everywhere else; any Stellar wallets already linked to them come back too. Customers can be looked up by email or phone, and updated by id.

A customer portal link can also be generated for any customer — a hosted page where they manage their own subscriptions and payment methods without you having to build that UI. Full field list: [API Reference: Customers](https://docs.stellartools.dev/api-reference/customers) and [API Reference: Portal](https://docs.stellartools.dev/api-reference/portal).

## Subscriptions

Creating a subscription needs a customer, a product, and optionally a trial length. From there, a subscription can be fetched, listed by customer, paused, resumed, canceled at the end of the current period (keeping access until then), or canceled immediately. Its status is one of trialing, active, past due, canceled, or paused. Full field list: [API Reference: Subscriptions](https://docs.stellartools.dev/api-reference/subscriptions).

## Payments and refunds

Payments can be listed (optionally filtered by customer) or fetched by id. Issuing a refund needs the payment being refunded and a reason, with optional metadata. Full field lists: [API Reference: Payments](https://docs.stellartools.dev/api-reference/payments) and [API Reference: Refunds](https://docs.stellartools.dev/api-reference/refunds).

## Balance

Fetching the balance returns the organization's per-asset Stellar balances and which network they're on. Payouts to local currency happen from the dashboard only — there's no way to create one through the SDK.

## Webhooks — verify before you trust anything

Creating a webhook needs a name, an HTTPS URL, and at least one event to subscribe to. It comes back with a signing secret — store it, since verifying deliveries requires it.

To verify a delivery: take the raw request body and the signature from the request's signature header, and check both against the stored secret. A bad, missing, or tampered signature should be a hard rejection — reject the request outright rather than logging a warning and processing the payload anyway. A verified delivery comes back as a typed event you can branch on, carrying the resource that triggered it and, for update events, which fields changed and what they were before. If a webhook endpoint doesn't respond with success, the delivery is retried, and every attempt is visible in the dashboard.

The event types that actually exist today: customer created/updated/deleted, a wallet linked or unlinked, a checkout created, a payment pending/confirmed/failed, a refund succeeded/failed, and a subscription created/updated/canceled. (The docs mention a subscription-renewed event that isn't real — see the drift note below.) Full envelope shape and event-by-event detail: [Webhooks](https://docs.stellartools.dev/webhooks) and [API Reference: Webhooks](https://docs.stellartools.dev/api-reference/webhooks).

## Idempotency

Any create call that might get retried after a timeout — a checkout, a subscription — can take a stable key of your choosing (e.g. an internal order id) so a retry can't double-charge or double-create the same thing.

## Error handling

Every call is a plain, awaitable function — on failure it throws a regular error, so wrap calls in try/catch. Bad input (a malformed email, a missing required field) is rejected before any network call happens at all. Beyond that, failures from the API itself fall into a handful of categories: bad request, unauthorized (a missing, invalid, or revoked key), forbidden, not found, conflict, rate limited, an internal error, or an upstream Stellar/network failure. Starting point for the whole REST surface: [API Reference: Introduction](https://docs.stellartools.dev/api-reference/introduction).

## Where the docs are, and where they've drifted from the SDK

The docs at [docs.stellartools.dev](https://docs.stellartools.dev) are good for the business concepts — what a billing period means, how retries behave — but some of their code samples are stale against the current SDK, e.g. in [TypeScript SDK](https://docs.stellartools.dev/integrations/typescript-sdk) and [Products](https://docs.stellartools.dev/products):

- They show the checkout resource under a singular name; it's actually plural on the client.
- Direct checkouts and product prices are shown using different field names than the SDK actually accepts.
- Subscription billing periods are shown as e.g. "monthly" rather than the actual short-form values the SDK expects.
- A third product type ("metered") is mentioned that doesn't exist in this SDK version — only one-time and subscription do.
- A customer access-check method shown in the docs doesn't exist on the customer resource in this SDK version.
- A subscription-renewed webhook event is mentioned that isn't in the real event list above.

If something isn't covered here, the SDK's own source under `packages/stellartools/src/` is what actually runs — trust it over a docs code sample.

Two lighter-weight ways to pull fresh context straight from the docs site, rather than trusting a stale link or a memorized answer:

- `**docs.stellartools.dev/llms.txt**` (and `llms-full.txt` for the complete, unabridged text) — a plain-text index of the whole documentation site, generated by Mintlify. No MCP client needed, just fetch it.
- `**docs.stellartools.dev/mcp**` — Mintlify also runs its own MCP server over this documentation site (confirmed live; distinct from the StellarTools product MCP server below, which is a completely different service at a different domain). Connecting to it lets an agent search and read the docs directly instead of relying on the static links in this file. It still only knows what the docs say, though — it won't catch the drift noted above, so cross-check anything it returns about field names or method signatures against the SDK source.

## MCP server — using StellarTools from an agent instead of code

StellarTools also exposes its own API as an MCP server at `https://api.stellartools.dev/mcp`, so an agent in Cursor, Claude Desktop, or any MCP client can work with a StellarTools account d

irectly, without SDK code. It authenticates the same way as the REST API — an API key sent on every connection, not just once — and tool arguments mirror the REST API, with path, query, and body fields merged into one object per call. Setup steps and config for both clients: [MCP Server](https://docs.stellartools.dev/integrations/mcp).

What's actually reachable through it turns out to be narrower than the docs suggest, and in one dimension wider — confirmed by reading which routes are actually wired into the MCP server, not just which ones say they support it:

- Customers, products, payments, and balances are fully covered — create, read, update, delete where those make sense. Products in particular are more complete here than the docs let on (listing and single-item fetch both work, undocumented).
- Checkouts can be read, updated, and deleted through MCP, but **not created** — a checkout has to be created via the SDK or REST API first.
- Subscriptions can only be listed through MCP — there's no fetch-by-id, update, pause, resume, or cancel tool available that way; those need the SDK.
- Webhooks can't be managed through MCP at all — no create, read, or update.
- Two tools that look like they should work — fetching supported currencies and supported assets — don't actually respond, despite being declared. The routes that back them were never wired into the module that loads tools into the MCP server's process, so the declaration exists but the tool doesn't. Anyone adding a new tool needs to check that their route is actually wired in, not just configured for it.

## Beyond direct integration

- **Marketplace apps** — third-party integrations installed from the dashboard, like Resend or Loops — are a different thing from a direct SDK integration; they're built against a separate app SDK. Only relevant if the actual task is building one of those. See [Marketplace: Building Apps](https://docs.stellartools.dev/marketplace/building-apps).
- **Platform-specific adapters** exist for MedusaJS, WooCommerce, BetterAuth, the Vercel AI SDK, LangChain, and UploadThing — use one of those instead of the raw SDK if the app already runs on one of those platforms. Each has its own doc page under [Integrations](https://docs.stellartools.dev/integrations/aisdk).
