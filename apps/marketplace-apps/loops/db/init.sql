CREATE TABLE IF NOT EXISTS event_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'testnet',
  event_type   TEXT NOT NULL,
  email        TEXT NOT NULL,
  send_type    TEXT NOT NULL,
  email_config TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_org ON event_log (org_id, environment, sent_at DESC);
