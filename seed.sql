-- ============================================================
-- Role + grants for main postgres DB
-- ============================================================
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'root') THEN
      CREATE ROLE root WITH LOGIN PASSWORD 'local';
   END IF;
END
$$;

\c postgres;
GRANT ALL ON SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO root;

-- ============================================================
-- resend_app database (for email_index tracking)
-- ============================================================
SELECT 'CREATE DATABASE resend_app' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'resend_app')\gexec

\c resend_app;
GRANT ALL ON SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO root;

CREATE TABLE IF NOT EXISTS email_index (
  email_id    TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'testnet',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_index_org_sent ON email_index (org_id, environment, sent_at);

-- ============================================================
-- loops_app database (for event_log tracking)
-- ============================================================
SELECT 'CREATE DATABASE loops_app' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'loops_app')\gexec

\c loops_app;
GRANT ALL ON SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO root;

CREATE TABLE IF NOT EXISTS event_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'testnet',
  event_type   TEXT NOT NULL,
  email        TEXT NOT NULL,
  send_type    TEXT NOT NULL,
  template_id  TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_log_org ON event_log (org_id, environment, sent_at DESC);

-- ============================================================
-- Seed data for postgres DB (run AFTER drizzle migrations)
-- ============================================================
\c postgres;

INSERT INTO public.app (id, name, slug, base_url, app_secret, webhook_url, publisher, features_markdown, price, tagline, website_url, support_email, scopes, "sensitiveKeys", version, status, icon_url) VALUES
  (
    'app_resend',
    'Resend',
    'resend',
    'http://localhost:3001',
    -- decrypted: sec_8Jx4rcuqeRf-UUjTqBMgZBcjnafOM_K7
    '__ST_ENC__:b8b42ecdd41becc7c234bfff43eef7840fa2724d62142f047066a909700bb53fa66ea1555da0527c7c646098ae73aa8eef1ee6acef37ca807a3fcd5c4d0e305a441f1c6f',
    'http://localhost:3001/api/webhook',
    'Resend',
    E'## Payment receipts and invoices, automatically\n\nEvery successful payment triggers a branded email receipt via Resend. Configure your template once — StellarTools handles delivery, retries, and logging so nothing slips through.\n\n## Full delivery visibility inside your dashboard\n\nTrack opens, bounces, and click-throughs without leaving StellarTools so your support team always knows exactly what a customer received and when.',
    'Free up to 3,000 emails/mo, then $20/mo',
    'Send transactional emails to your customers without leaving StellarTools.',
    'https://resend.com',
    'support@resend.com',
    ARRAY['read:customers','read:payments','read:refunds','read:subscriptions'],
    ARRAY['resendApiKey'],
    '1.0',
    'available',
    'https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IDnuauWFYzKwRMe0dbSGsfZNQBvlmITOtLkjF'
  ),
  (
    'app_loops',
    'Loops',
    'loops',
    'https://loops.so',
    -- decrypted: sec_Lp9k2mQvXr4TtZbN7yWdHsEfGcAj5oPu
    '__ST_ENC__:b22e6024921f9b8e5f52e0dc3ed44c71a5e99266bc96f93e1933e0293d574c71301754020070a2d3c0e574b21e1b42ca4d19945d2cc0db010b67f3b93e1f54280b5a5af8',
    NULL,
    'Loops',
    E'## Sync customers the moment they pay\n\nWhen a customer completes their first payment in StellarTools, Loops automatically adds them to your audience and fires your onboarding sequence. No webhooks to wire up, no CSVs to export.\n\n## Automate every subscription milestone\n\nCancellations, upgrades, failed payments, trial expirations — map any StellarTools event to a Loop and keep users engaged at every stage of the lifecycle.',
    'Free up to 2,000 contacts, then $49/mo',
    'Trigger lifecycle email sequences from real-time payment and subscription events.',
    'https://loops.so',
    'help@loops.so',
    ARRAY['read:customers','read:payments','read:refunds','read:subscriptions'],
    ARRAY['loopsApiKey'],
    '1.0',
    'available',
    'https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IAZDxDCKLFrwdU65KkJi9NqmajuMtEnDOx1cT'
  ),
  (
    'app_firstpromoter',
    'FirstPromoter',
    'firstpromoter',
    'https://firstpromoter.com',
    -- decrypted: sec_Fp3nR8wKjLqZxCvB2mYtHdSeUa6oNi7
    '__ST_ENC__::bda4a7d6ea24ff65b5944b02941593198415def944ec06ca9dc68423c56ff16f9dd56c9ee23172ab324baf61daadf04d1c835a94c2316248d96f151a4e17261f1fafb5',
    NULL,
    'FirstPromoter',
    E'## Commissions tied to real revenue\n\nFirstPromoter reads your StellarTools payments to calculate affiliate commissions automatically. Every successful charge is attributed to the right promoter — no manual tracking, no disputes.\n\n## Manage your affiliate program without switching tabs\n\nApprove applications, set commission tiers, view leaderboards, and trigger payouts directly from your StellarTools dashboard.',
    'Starts at $49/mo',
    'Launch a referral or affiliate program that tracks commissions directly from your StellarTools revenue.',
    'https://firstpromoter.com',
    'support@firstpromoter.com',
    ARRAY['read:customers','read:payments','read:refunds','read:subscriptions'],
    ARRAY['FirstPromoterApiKey'],
    '1.0',
    'coming_soon',
    'https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IJBKCsNfEzD8FRHNolx7X5VhkTgrbjfAZPpSa'
  ),
  (
    'app_posthog',
    'PostHog',
    'posthog',
    'https://posthog.com',
    -- decrypted: sec_Ph5tWqYzMnKjVbXcRd8La2EfGsHu9oPi
    '__ST_ENC__:9872e6800de8b03bef2d092afb1f747c34661c0662aa83a9c8027a9c606f1e3028002c878c36dcae6dc5cf15482af76b982d09ab27236ee63ac41e66900cbcdfc1e53f63',
    NULL,
    'PostHog',
    E'## Revenue events in your product funnels\n\nPipe payment, subscription, and churn events from StellarTools into PostHog as custom events. Build funnels that show the full journey from first visit to paid customer.\n\n## Segment product analytics by revenue tier\n\nStellarTools enriches PostHog person profiles with plan, MRR, and payment status so you can filter session recordings, feature flags, and experiments by what customers actually pay.',
    'Free up to 1M events/mo, then usage-based',
    'Connect your revenue data to PostHog''s product analytics — see which features drive conversions and retention.',
    'https://posthog.com',
    'hey@posthog.com',
    ARRAY['read:customers','read:payments','read:refunds','read:subscriptions'],
    ARRAY['posthugApiKey'],
    '1.0',
    'coming_soon',
    'https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8InYN939nBaHU7t1CPbms8dX3phBTJclYyExAK'
  )
ON CONFLICT (id) DO NOTHING;


INSERT INTO public.supported_asset (id, code, canonical_issuer, network, metadata, description, images) VALUES
  ('supported_asset_1', 'XLM', NULL, 'testnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_2', 'XLM', NULL, 'mainnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_3', 'USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', 'testnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Testnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0McDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa']),
  ('supported_asset_4', 'USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 'mainnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Mainnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0MacDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa'])
ON CONFLICT (id) DO NOTHING;
