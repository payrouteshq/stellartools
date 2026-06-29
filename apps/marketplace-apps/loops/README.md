# Loops — StellarTools Marketplace App

Syncs customers to a Loops audience and triggers email journeys when payment and subscription events fire in a merchant's StellarTools account.

## What it does

- On install, the merchant pastes their Loops API key. The app verifies it and saves the credentials.
- The dashboard lets merchants map each event type to a Loops event name and toggle contact syncing on or off.
- When an event fires, the webhook handler sends the corresponding Loops event with the relevant data attached.
- New customers are optionally created as Loops contacts when customerSyncEnabled is true.

## Running locally

```bash
pnpm install
pnpm dev        # starts on port 3002
```

Set these env vars:

```env
YOUR_APP_SECRET=          # signing secret from the StellarTools developer portal
NEXT_PUBLIC_APP_URL=http://localhost:3002
WEBHOOK_SECRET=           # webhook signing secret
```

## Structure

```
app/
  page.tsx                 routes to /authentication or /dashboard based on settings
  authentication/          API key input and validation
  dashboard/               event-to-journey mapping and sync toggle
  api/webhook/route.ts     receives and handles StellarTools events
  actions/
    context.ts             resolveAppContext — verifies the st_token server-side
    loops.ts               validateApiKeyAndConnect, event sending helpers
```

## Events handled

payment.confirmed, payment.failed, refund.succeeded, subscription.created, subscription.canceled, customer.created

Full event reference: https://stellartools.dev/docs/webhooks#event-types
