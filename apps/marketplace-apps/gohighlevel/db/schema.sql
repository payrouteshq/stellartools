CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

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

CREATE TABLE IF NOT EXISTS ghl_credentials (
  ghl_secret                  TEXT PRIMARY KEY,
  location_id                 TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment                 TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  stellar_api_key_encrypted   TEXT NOT NULL,
  publishable_key             TEXT NOT NULL,
  webhook_id                  TEXT,
  webhook_secret_encrypted    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, environment)
);

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

CREATE TABLE IF NOT EXISTS ghl_subscription_products (
  ghl_subscription_id TEXT PRIMARY KEY,
  location_id         TEXT NOT NULL REFERENCES ghl_locations(location_id) ON DELETE CASCADE,
  environment          TEXT NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
  stellar_product_id   TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
