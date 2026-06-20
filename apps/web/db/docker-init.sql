CREATE DATABASE postgres;

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

INSERT INTO public.app (id, name, slug, base_url, app_secret, webhook_url, publisher, features_markdown, price, tagline, website_url, support_email, manifest) VALUES
  (
    'app_resend',
    'Resend',
    'resend',
    'http://localhost:3001',
    'sec_8Jx4rcuqeRf-UUjTqBMgZBcjnafOM_K7',
    'http://localhost:3001/api/webhook',
    'Resend',
    E'## Payment receipts and invoices, automatically\n\nEvery successful payment triggers a branded email receipt via Resend. Configure your template once — StellarTools handles delivery, retries, and logging so nothing slips through.\n\n## Full delivery visibility inside your dashboard\n\nTrack opens, bounces, and click-throughs without leaving StellarTools so your support team always knows exactly what a customer received and when.',
    'Free up to 3,000 emails/mo, then $20/mo',
    'Send transactional emails to your customers without leaving StellarTools.',
    'https://resend.com',
    'support@resend.com',
    '{"name":"Resend","description":"Send transactional emails to your customers without leaving StellarTools.","iconUrl":"https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8IDnuauWFYzKwRMe0dbSGsfZNQBvlmITOtLkjF","homepageUrl":"https://resend.com","baseUrl":"http://localhost:3001","webhookUrl":"http://localhost:3001/api/webhook","scopes":["read:customers","read:payments"]}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET app_secret = EXCLUDED.app_secret;

INSERT INTO public.supported_asset (id, code, canonical_issuer, network, metadata, description, images) VALUES
  ('supported_asset_1', 'XLM', NULL, 'testnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_2', 'XLM', NULL, 'mainnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_3', 'USDC', 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER', 'testnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Testnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0McDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa']),
  ('supported_asset_4', 'USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 'mainnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Mainnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0McDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa']);
