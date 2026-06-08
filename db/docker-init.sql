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

INSERT INTO public.supported_asset (id, code, issuers, network, metadata, description, images) VALUES
  ('supported_asset_1', 'XLM', NULL, 'testnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_2', 'XLM', NULL, 'mainnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ipo19sUHkH8hj3xwcIloqJz6mdZeuWfEAVi4L']),
  ('supported_asset_3', 'USDC', ARRAY['GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER'], 'testnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Testnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0McDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa']),
  ('supported_asset_4', 'USDC', ARRAY['GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'], 'mainnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Mainnet', ARRAY['https://8rcejvvfub.ufs.sh/f/PUZcIXo3ao8Ib0McDTYRSWChAKdv1tXG0YfyxQLZMce3UTFa']);
