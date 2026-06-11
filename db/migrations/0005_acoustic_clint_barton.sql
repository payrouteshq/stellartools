ALTER TABLE "supported_asset" RENAME COLUMN "issuers" TO "canonical_issuer";--> statement-breakpoint
ALTER TABLE "supported_asset" DROP CONSTRAINT "supported_asset_code_issuers_network_unique";--> statement-breakpoint
ALTER TABLE "supported_asset" ADD CONSTRAINT "supported_asset_code_canonical_issuer_network_unique" UNIQUE("code","canonical_issuer","network");