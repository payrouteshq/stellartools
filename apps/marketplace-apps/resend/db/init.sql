CREATE TABLE IF NOT EXISTS email_index (
  email_id    TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'testnet',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_index_org_sent ON email_index (org_id, environment, sent_at);
