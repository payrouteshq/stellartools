ALTER TABLE "supported_asset" DROP CONSTRAINT IF EXISTS "supported_asset_code_issuers_environment_unique";
ALTER TABLE "supported_asset" DROP COLUMN IF EXISTS "issuers";
ALTER TABLE "supported_asset" ADD COLUMN IF NOT EXISTS "canonical_issuer" text;
ALTER TABLE "supported_asset" ADD CONSTRAINT "supported_asset_code_canonical_issuer_environment_unique" UNIQUE("code","canonical_issuer","environment");
