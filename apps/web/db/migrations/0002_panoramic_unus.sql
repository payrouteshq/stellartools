DROP TABLE "secret_access_log" CASCADE;--> statement-breakpoint
ALTER TABLE "organization_secret" DROP COLUMN "testnet_secret_version";--> statement-breakpoint
ALTER TABLE "organization_secret" DROP COLUMN "mainnet_secret_version";--> statement-breakpoint
DROP TYPE "public"."secret_access_log_action";