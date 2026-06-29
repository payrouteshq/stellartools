# Resend — StellarTools Marketplace App

Sends transactional emails via Resend when payment, subscription, and refund events fire in a merchant's StellarTools account.

## What it does

- On install, the merchant pastes their Resend API key. The app verifies it and auto-resolves a sender address from their first verified domain.
- The dashboard lets merchants map each event type to a Resend email template ID, and toggle customer contact syncing on or off.
- When an event fires, the webhook handler sends the corresponding email using the saved template and the event payload as template variables.
- New customers are optionally synced to a Resend contacts audience when customerSyncEnabled is true.

## Running locally

```bash
pnpm install
pnpm dev        # starts on port 3001
```

Set these env vars:

```env
YOUR_APP_SECRET=          # signing secret from the StellarTools developer portal
NEXT_PUBLIC_APP_URL=http://localhost:3001
WEBHOOK_SECRET=           # webhook signing secret
```

## Structure

```
app/
  page.tsx                 routes to /authentication or /dashboard based on settings
  authentication/          API key input and validation
  dashboard/               template ID mapping and sync toggle
  api/webhook/route.ts     receives and handles StellarTools events
  actions/
    context.ts             resolveAppContext — verifies the st_token server-side
    resend.ts              validateApiKeyAndConnect, email sending helpers
```

## Events handled

payment.confirmed, payment.failed, refund.succeeded, subscription.created, subscription.canceled, customer.created

Full event reference: https://stellartools.dev/docs/webhooks#event-types
