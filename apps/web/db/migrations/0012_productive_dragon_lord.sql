CREATE TYPE "public"."payout_method" AS ENUM('crypto', 'fiat');--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT "crypto_or_fiat_constraint";--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "method" "payout_method" DEFAULT 'crypto' NOT NULL;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "provider_transaction_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "destination_currency" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "destination_country" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "withdrawal_method" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "quote_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "provider_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "failure_message" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "funding_transaction_xdr" text;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_provider_transaction_unique" UNIQUE("provider","provider_transaction_id");--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "crypto_or_fiat_constraint" CHECK (("payout"."method" = 'crypto' AND "payout"."selected_asset_code" IS NOT NULL AND ("payout"."transaction_hash" IS NOT NULL OR "payout"."status" = 'pending')) OR ("payout"."method" = 'fiat' AND "payout"."selected_asset_code" IS NOT NULL));