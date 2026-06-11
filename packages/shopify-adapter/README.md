# StellarTools Shopify Adapter

A Shopify embedded app that adds StellarTools as a payment method at checkout. Built with React Router and `@shopify/shopify-app-react-router`. The adapter is stateless — it stores no data locally. All sessions and org connections are persisted in the main StellarTools PostgreSQL database via authenticated HTTP.

---

## What appears at checkout

When a merchant installs and activates this app, Shopify adds **StellarTools Payments** as a payment option inside the checkout payment step — sitting alongside credit cards, PayPal, and any other enabled payment methods.

When a customer selects StellarTools Payments and clicks Pay now, Shopify calls this adapter's `/payment-session` endpoint. The adapter creates a hosted checkout on StellarTools and redirects the customer there to pay with USDC, XLM, EURC, or any other Stellar asset. After payment, the customer is sent back to Shopify where the order is marked as paid.

This is a Shopify **offsite payment extension** (`payments_extension` type). Shopify routes the customer off-site to StellarTools, then back. No card data is collected inside Shopify.

---

## How webhook verification works

The adapter uses two distinct verification methods depending on the route type.

### App webhooks (uninstall / scopes update)

Routes: `/webhooks/app/uninstalled`, `/webhooks/app/scopes_update`

These are verified by calling `authenticate.webhook(request)` from `@shopify/shopify-app-react-router`. The library automatically:
- Reads the `X-Shopify-Hmac-Sha256` header
- Recomputes HMAC-SHA256 of the raw body using `SHOPIFY_API_SECRET`
- Throws and returns 401 if the signatures do not match
- Returns `{ shop, topic, payload, session }` if valid

```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // only reached if HMAC is valid
};
```

### Payment session routes (payment / refund / capture / void)

Routes: `/payment-session`, `/refund-session`, `/capture-session`, `/void-session`

These are external HTTP POST requests from Shopify's payment infrastructure, not from the embedded app. They are verified manually using `crypto.timingSafeEqual` to prevent timing attacks:

```typescript
function verifyShopifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}
```

The `X-Shopify-Hmac-Sha256` header value is base64-encoded HMAC-SHA256 of the raw request body, signed with `SHOPIFY_API_SECRET`. The raw body must be read as text before parsing as JSON, otherwise the signature check fails.

---

## How checkout is handled

This is the full lifecycle from the moment a customer clicks Pay now.

### 1. Shopify calls POST /payment-session

Shopify sends the order details to the adapter:

```json
{
  "id": "gid://shopify/PaymentSession/abc123",
  "amount": "49.99",
  "currency": "USD",
  "shop": "mystore.myshopify.com",
  "test": true,
  "kind": "sale",
  "merchant_reference": "order-ref-001",
  "checkout_url": "https://mystore.myshopify.com/checkout/..."
}
```

### 2. Adapter verifies HMAC

Reads the raw body as text, computes HMAC-SHA256 with `SHOPIFY_API_SECRET`, compares with `X-Shopify-Hmac-Sha256` header using `timingSafeEqual`. Returns 401 immediately if it fails.

### 3. Adapter looks up the org API key

Calls `GET /~api/shopify/org-apikey?shop=mystore.myshopify.com` on the main app (authenticated with `INTERNAL_API_SECRET`). The main app finds the session row with a non-null `organizationId` and returns the active API key for that org.

If no API key is found (shop not connected), the adapter fetches the shop access token, calls `paymentSessionReject` on the Shopify Admin API, and returns `200 {}` so Shopify falls back to another payment method.

### 4. Adapter builds a signed callback URL

To safely return the customer after payment without exposing the payment GID in a guessable URL, the adapter creates a signed callback:

```
sig = HMAC-SHA256(INTERNAL_API_SECRET, "${gid}:${shop}") as hex
callbackUrl = SHOPIFY_APP_URL/payment-complete?gid=...&shop=...&sig=...
```

This signature is verified when the customer returns, so only a callback from StellarTools (which received the URL) can resolve the payment.

### 5. Adapter creates a StellarTools checkout

Calls `POST /api/checkout?type=direct` on the StellarTools checkout app:

```json
{
  "amount": 49.99,
  "asset_code": "USDC",
  "redirect_url": "<signed callback URL>",
  "metadata": {
    "shopify_payment_session_gid": "gid://shopify/PaymentSession/abc123",
    "shopify_shop": "mystore.myshopify.com",
    "shopify_merchant_reference": "order-ref-001"
  }
}
```

### 6. Adapter returns the redirect URL to Shopify

```json
HTTP 201
{ "redirect_url": "https://checkout.stellartools.dev/pay/xyz..." }
```

Shopify immediately redirects the customer's browser to that URL.

### 7. Customer pays on StellarTools

The customer connects their Stellar wallet (Freighter, LOBSTR, etc.) and sends USDC or another Stellar asset. StellarTools confirms the transaction on-chain.

---

## How a completed purchase is resolved

After the customer pays, StellarTools redirects them to the signed callback URL:

```
GET /payment-complete?gid=gid://shopify/PaymentSession/abc123&shop=mystore.myshopify.com&sig=<hex>
```

### Step 1 - Verify the callback signature

The adapter recomputes `HMAC-SHA256(INTERNAL_API_SECRET, "${gid}:${shop}")` and compares it with the `sig` param using `timingSafeEqual`. If it does not match, the customer is redirected to the shop homepage and nothing is resolved.

This prevents anyone from crafting a fake callback URL to falsely resolve a payment.

### Step 2 - Get the shop access token

The adapter calls `GET /~api/shopify/sessions?shop=mystore.myshopify.com` on the main app to find the session row for this shop. It picks the session that has a non-null `organizationId` and reads its `accessToken` (the Shopify Admin API token granted during OAuth install).

### Step 3 - Call paymentSessionResolve on the Shopify Admin API

Using the access token, the adapter calls the Shopify Payments Apps GraphQL API:

```graphql
mutation paymentSessionResolve($id: ID!) {
  paymentSessionResolve(id: $id) {
    paymentSession {
      nextAction {
        context {
          ... on PaymentSessionActionsRedirect {
            redirectUrl
          }
        }
      }
    }
    userErrors { message }
  }
}
```

This tells Shopify the payment was successful and asks where to send the customer next.

### Step 4 - Redirect the customer

Shopify responds with a `redirectUrl` (the thank-you page for that order). The adapter redirects the customer's browser there. The order appears in Shopify Admin as **Paid**.

If anything fails (bad signature, no access token, GraphQL error), the adapter falls back to redirecting to `https://{shop}/` so the customer is not left stranded.

---

## Prerequisites

### Accounts and access

| Requirement | Where to get it |
|---|---|
| Shopify Partner account | partners.shopify.com |
| Shopify development store | Partner Dashboard -> Stores -> Add store -> Development store |
| StellarTools account and organization | Your local StellarTools dashboard |
| StellarTools API key (`st_key_...`) | Dashboard -> API Keys -> Create key |
| Shopify Payments Partner enrollment | Contact Shopify Partner support — required before the extension appears at checkout |

### Tools

```bash
node -v        # 18+
pnpm -v        # any recent version
npx shopify version  # should be 4.x
```

---

## Local setup

### 1. Install dependencies

```bash
# from the repo root
pnpm install
```

### 2. Set environment variables

Create or update `packages/shopify-adapter/.env`:

```env
# From Shopify Partner Dashboard -> Apps -> stellartools -> Settings
SHOPIFY_API_KEY=f1b7c86f37c40aae0065942e67f80c06
SHOPIFY_API_SECRET=shpss_...

# OAuth scopes (comma-separated, no spaces)
SCOPES=read_orders,read_checkouts

# Main StellarTools app URLs
STELLAR_TOOLS_API_URL=http://dashboard.localhost:3000/~api
STELLAR_TOOLS_DASHBOARD_URL=http://dashboard.localhost:3000
STELLAR_TOOLS_CHECKOUT_URL=http://localhost:3000

# Shared secret — must match INTERNAL_API_SECRET in the main app .env
INTERNAL_API_SECRET=<your-shared-secret>
```

`SHOPIFY_APP_URL` is not set here. The Shopify CLI injects it automatically when you run `shopify app dev`.

### 3. Start the main StellarTools app first

The adapter has no local database. All session reads and writes go to the main app. It must be running before the adapter starts.

```bash
# from repo root
pnpm dev
```

Verify the session API responds:

```bash
curl -s -H "Authorization: Bearer <INTERNAL_API_SECRET>" \
  "http://dashboard.localhost:3000/~api/shopify/sessions?shop=test.myshopify.com"
# should return: []
```

### 4. Start the adapter

```bash
cd packages/shopify-adapter
npx shopify app dev --config shopify.app.stellartools.toml
```

The CLI will:
- Ask you to select your Partner organization and app
- Ask which development store to use
- Start a public HTTPS tunnel (Cloudflare)
- Inject `SHOPIFY_APP_URL` with the tunnel URL
- Open the app in your dev store Shopify Admin

Press `p` to open the embedded app.

---

## Step-by-step: connect a store

### 1. Install the app

Run `shopify app dev`, select your dev store, press `p`. The app OAuth flow runs automatically and you land on the Home screen showing "Store not connected."

### 2. Create a StellarTools API key

1. Open `http://dashboard.localhost:3000`
2. Log in, go to API Keys, create a new key
3. Copy the `st_key_...` value

### 3. Connect the store

1. In the embedded app, click **Get started** in the nav
2. Paste your `st_key_...` into the API key field
3. Click **Connect store**

Behind the scenes:
- `POST /~api/shopify/connect { shop, apiKey }` — links the shop to your org in the database
- `paymentsAppConfigure(ready: true)` — notifies Shopify this app is ready to process payments
- You are redirected to the Shopify payments activation page

### 4. Activate the payment method

On the Shopify payments settings page:
1. Enable **Test mode**
2. Click **Activate**

StellarTools Payments will now appear in the checkout payment step for your dev store.

> This step requires Payments Partner enrollment. See the section below.

### 5. Verify in the Home screen

Go back to the embedded app Home. You should see:
- Organization ID (with copy button)
- StellarTools API URL (with copy button)
- Webhook endpoint (with copy button)
- Active scopes shown as pills

---

## Step-by-step: test a payment

### 1. Place an order

In your dev store, add a product to the cart and begin checkout. At the Payment step, select **StellarTools Payments** and click Pay now.

### 2. Pay on StellarTools

You are redirected to the StellarTools hosted checkout. Use a Stellar testnet wallet (Freighter works) with testnet USDC.

### 3. Order confirmed

After payment, you land on the Shopify thank-you page. The order appears in Shopify Admin -> Orders as **Paid**.

---

## Testing endpoints directly

You can hit the payment routes directly without going through the Shopify checkout.

### Generate a test HMAC

```bash
node -e "
  const crypto = require('crypto');
  const secret = process.env.SHOPIFY_API_SECRET;
  const body = JSON.stringify({
    id: 'gid://shopify/PaymentSession/1',
    amount: '10.00',
    currency: 'USD',
    shop: 'your-store.myshopify.com',
    test: true,
    merchant_reference: 'ref_001',
    kind: 'sale',
    checkout_url: ''
  });
  const sig = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  console.log('Sig:', sig);
  console.log('Body:', body);
"
```

### POST /payment-session

```bash
curl -X POST https://<tunnel-url>/payment-session \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: <sig>" \
  -d '<body>'

# Shop connected:     HTTP 201  { "redirect_url": "https://..." }
# Shop not connected: HTTP 200  {}
# Bad HMAC:           HTTP 401
```

### POST /refund-session

```bash
node -e "
  const crypto = require('crypto');
  const secret = process.env.SHOPIFY_API_SECRET;
  const body = JSON.stringify({
    id: 'gid://shopify/RefundSession/1',
    payment_id: 'gid://shopify/PaymentSession/1',
    amount: '10.00',
    currency: 'USD',
    shop: 'your-store.myshopify.com',
    merchant_reference: 'ref_001'
  });
  const sig = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  console.log(sig);
"

curl -X POST https://<tunnel-url>/refund-session \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: <sig>" \
  -d '<body>'
# HTTP 200 {}
```

### Trigger webhooks via Shopify CLI

```bash
npx shopify webhook trigger \
  --topic=app/uninstalled \
  --config shopify.app.stellartools.toml

npx shopify webhook trigger \
  --topic=app/scopes_update \
  --config shopify.app.stellartools.toml
```

---

## Payments Partner enrollment

The `payments_extension` type requires your Shopify Partner account to be enrolled in the Shopify Payments Platform. Without it:

- `npx shopify app deploy` fails with `Beta requirements not met`
- The payment method does not appear at checkout
- The activation page is blank

**How to apply:**

1. Go to partners.shopify.com
2. Click your account name -> Contact support
3. Select **Apps** as the topic
4. Ask to be enrolled in the **Payments Platform**, mentioning you are building an offsite payment provider

Once approved, deploy:

```bash
npx shopify app deploy --config shopify.app.stellartools.toml
```

Then activate in your dev store: Shopify Admin -> Settings -> Payments -> StellarTools Payments -> Activate (Test mode).

---

## What is and is not implemented

| Feature | Status |
|---|---|
| OAuth install and session storage | Done |
| Merchant connect via API key | Done |
| Payment session (create checkout, redirect) | Done |
| Payment callback (verify, resolve, redirect) | Done |
| HMAC verification on all payment routes | Done |
| Signed callback URL (prevents forgery) | Done |
| App uninstall webhook (disconnects shop) | Done |
| Scopes update webhook | Done |
| Capture session | No-op — StellarTools captures immediately |
| Void session | No-op — pending payments expire automatically |
| Refund session | Stub — needs Stellar payment reversal using `payment_id` |
| Payment extension at checkout | Blocked on Payments Partner enrollment |

---

## Environment variables

| Variable | Purpose |
|---|---|
| `SHOPIFY_API_KEY` | App identity, used in payments activation URL |
| `SHOPIFY_API_SECRET` | OAuth token exchange, HMAC verification on payment routes |
| `SCOPES` | Comma-separated OAuth scopes requested on install |
| `SHOPIFY_APP_URL` | Injected by CLI. Used to build the signed payment callback URL |
| `STELLAR_TOOLS_API_URL` | Base for all internal API calls to the main app (`/~api`) |
| `STELLAR_TOOLS_DASHBOARD_URL` | Used for dashboard links shown to merchants in the UI |
| `STELLAR_TOOLS_CHECKOUT_URL` | Base for the checkout API (`POST /api/checkout`) |
| `INTERNAL_API_SECRET` | Bearer token authenticating adapter-to-main-app HTTP calls |

---

## Project structure

```
packages/shopify-adapter/
├── app/
│   ├── shopify.server.ts              Shopify app instance, RemoteSessionStorage wired in
│   ├── session-storage.server.ts      Proxies all session ops to main app via HTTP
│   └── routes/
│       ├── _index/route.tsx           Public landing page (not embedded)
│       ├── auth.$.tsx                 OAuth callback — library handles token exchange
│       ├── auth.login/route.tsx       Manual install entry point
│       ├── app.tsx                    Embedded app layout and nav
│       ├── app._index.tsx             Home screen — connection details, manage, disconnect
│       ├── app.additional.tsx         Connect form — paste API key to link store
│       ├── payment-session.tsx        Shopify calls this when customer clicks Pay now
│       ├── payment-complete.tsx       Customer lands here after paying on StellarTools
│       ├── refund-session.tsx         Shopify calls this when merchant issues a refund
│       ├── capture-session.tsx        No-op acknowledgement
│       ├── void-session.tsx           No-op acknowledgement
│       ├── webhooks.app.uninstalled   Disconnects shop from org on uninstall
│       └── webhooks.app.scopes_update Updates scope in session after permission change
├── extensions/
│   └── stellar-payments/
│       └── shopify.extension.toml     Registers the payment extension with Shopify
├── shopify.app.stellartools.toml      App config: scopes, webhook subscriptions, auth
├── shopify.web.toml                   Dev server command config
└── .env                               Local environment variables
```
