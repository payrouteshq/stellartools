CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

-- One row per installed GHL sub-account (location), holding the OAuth tokens we got from the
-- install flow and whether we've already registered the provider config with HighLevel.
CREATE TABLE IF NOT EXISTS ghl_locations (
  location_id             TEXT PRIMARY KEY,
  company_id              TEXT,
  access_token            TEXT NOT NULL,
  refresh_token           TEXT NOT NULL,
  token_expires_at        TIMESTAMPTZ NOT NULL,
  provider_registered_at  TIMESTAMPTZ,
  installed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (location, test|live) StellarTools connection. `ghl_secret` is the random token
-- we mint and hand to HighLevel's Connect Config API as `apiKey` — HighLevel echoes it back on
-- every queryUrl/webhook call, which is how we authenticate the request and know which org's
-- StellarTools key to use. `stellar_api_key_encrypted` is the merchant's own StellarTools
-- secret key, AES-256-GCM encrypted at rest.
CREATE TABLE IF NOT EXISTS ghl_credentials (
  ghl_secret                  TEXT PRIMARY KEY,
  location_id                 TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment                 TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  stellar_api_key_encrypted   TEXT NOT NULL,
  publishable_key             TEXT NOT NULL,
  -- StellarTools webhook (payment.confirmed/payment.failed) registered at `/api/stellar/webhook/{ghl_secret}`,
  -- so the URL path itself tells the receiver which org's signing secret to verify with.
  webhook_id                  TEXT,
  webhook_secret_encrypted    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, environment)
);

-- One row per StellarTools checkout created from the paymentsUrl iframe. Bridges HighLevel's
-- chargeId (= our checkout id) to the resulting StellarTools payment id once it lands via
-- webhook, since the public SDK has no "get payment by checkout id" lookup.
CREATE TABLE IF NOT EXISTS ghl_checkouts (
  checkout_id         TEXT PRIMARY KEY,
  location_id         TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment         TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  ghl_transaction_id  TEXT NOT NULL,
  ghl_contact_id      TEXT,
  ghl_subscription_id TEXT,
  payment_id          TEXT,
  status              TEXT NOT NULL DEFAULT 'open',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_checkouts_location ON ghl_checkouts (location_id);

-- One StellarTools subscription-type product per GHL subscription that started through the
-- checkout iframe (customer present, real approval signed) — the product is `hidden: true` so
-- it never shows up in the merchant's own product list, but backs a real on-chain subscription
-- via StellarTools' existing product/subscription flow. Populated lazily by /api/checkout.
CREATE TABLE IF NOT EXISTS ghl_subscription_products (
  ghl_subscription_id TEXT PRIMARY KEY,
  location_id         TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment          TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  stellar_product_id   TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interactive-recurring subscription schedules for GHL's *other* subscription entry point —
-- `create_subscription` queryUrl requests, fired when a GHL admin creates a manual schedule
-- with no customer wallet present to sign a real approval. There's nothing to silently charge
-- at that moment, so we store the schedule and prompt the customer each billing date instead.
CREATE TABLE IF NOT EXISTS ghl_subscription_schedules (
  ghl_subscription_id  TEXT PRIMARY KEY,
  location_id          TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment           TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  contact_id            TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  currency_code         TEXT NOT NULL,
  interval_days         INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'canceled')),
  next_charge_at        TIMESTAMPTZ NOT NULL,
  last_checkout_id      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_schedules_due ON ghl_subscription_schedules (status, next_charge_at);
