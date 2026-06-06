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

INSERT INTO public.asset (id, code, issuer, network, metadata, description) VALUES
  ('ast_1', 'XLM', 'native', 'testnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM'),
  ('ast_2', 'XLM', 'native', 'mainnet',  '{"coingeckoId":"stellar","decimals":7}'::jsonb, 'Native XLM'),
  ('ast_3', 'USDC', 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER', 'testnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Testnet'),
  ('ast_4', 'USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 'mainnet', '{"decimals":7,"usdPeg":true}'::jsonb, 'USDC by Circle on Mainnet');
