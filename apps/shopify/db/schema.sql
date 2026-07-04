-- Shopify app database schema

CREATE TABLE IF NOT EXISTS shopify_shop (
  id                        TEXT PRIMARY KEY,
  shop_domain               TEXT NOT NULL UNIQUE,
  access_token              TEXT NOT NULL,
  stellartools_api_key      TEXT,
  environment               TEXT NOT NULL DEFAULT 'testnet',
  settings                  JSONB,
  installed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at            TIMESTAMPTZ,
  stellartools_webhook_id   TEXT,
  stellartools_webhook_secret TEXT
);

CREATE TABLE IF NOT EXISTS shopify_session (
  id             TEXT PRIMARY KEY,
  shop           TEXT NOT NULL,
  state          TEXT NOT NULL,
  is_online      BOOLEAN NOT NULL DEFAULT FALSE,
  scope          TEXT,
  expires        TIMESTAMPTZ,
  access_token   TEXT,
  user_id        TEXT,
  first_name     TEXT,
  last_name      TEXT,
  email          TEXT,
  account_owner  BOOLEAN NOT NULL DEFAULT FALSE,
  locale         TEXT,
  collaborator   BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS shopify_payment_sessions (
  id                        TEXT PRIMARY KEY,
  gid                       TEXT NOT NULL,
  shop                      TEXT NOT NULL,
  stellartools_checkout_id  TEXT,
  stellartools_payment_id   TEXT,
  amount                    TEXT NOT NULL,
  currency                  TEXT NOT NULL,
  customer_email            TEXT,
  cancel_url                TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pending',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refund_sessions (
  id                      TEXT PRIMARY KEY,
  gid                     TEXT NOT NULL,
  shop                    TEXT NOT NULL,
  payment_gid             TEXT NOT NULL,
  stellartools_refund_id  TEXT,
  amount                  TEXT NOT NULL,
  currency                TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
