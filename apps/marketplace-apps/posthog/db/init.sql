CREATE TABLE IF NOT EXISTS cohorts (
  id                TEXT PRIMARY KEY,
  installation_id   TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  match             TEXT NOT NULL DEFAULT 'all',
  blocks            JSONB NOT NULL DEFAULT '[]',
  posthog_cohort_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_inst ON cohorts (installation_id, updated_at DESC);
