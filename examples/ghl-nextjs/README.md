# GoHighLevel Integration Example (Next.js)

This example demonstrates how to simulate and test the **StellarTools GoHighLevel Custom Payments Provider** locally without needing to submit an app to HighLevel's public marketplace.

## What's Here

- `app/page.tsx` — A simulated GoHighLevel checkout container page. It embeds the StellarTools checkout iframe (`http://localhost:3000/ghl/checkout`) and sends the `payment_initiate_props` `postMessage` contract.

## Local Testing Guide

### 1. Database & Services Setup

Make sure local Postgres is running (e.g., via Docker container `docker compose start`) and apply the GoHighLevel marketplace app schema:

```bash
psql "$GHL_APP_DATABASE_URL" -f apps/marketplace-apps/gohighlevel/db/init.sql
```

### 2. Seed Test Location & Credentials

Insert a test location into your local database:

```sql
INSERT INTO ghl_locations (location_id, access_token, refresh_token, token_expires_at)
VALUES ('test-location', 'x', 'x', NOW() + INTERVAL '1 hour');
```

Connect your StellarTools testnet API key:

- Open `http://localhost:3000/ghl/config?locationId=test-location`
- Paste your StellarTools testnet secret key and save.

### 3. Run the Simulator

Start the simulator app:

```bash
pnpm --filter example-ghl-nextjs dev
```

Open `http://localhost:3005` in your browser and click **"Simulate GHL PostMessage Init Props"**.

This will load the real StellarTools Checkout UI inside the embedded iframe and initiate the checkout flow!
