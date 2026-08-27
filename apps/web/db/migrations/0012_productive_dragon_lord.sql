DO $$ BEGIN
  CREATE TYPE "public"."payout_method" AS ENUM('crypto', 'fiat');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT IF EXISTS "crypto_or_fiat_constraint";--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "method" "payout_method" DEFAULT 'crypto' NOT NULL;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "provider_transaction_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "provider_status" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "destination_currency" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "destination_country" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "withdrawal_method" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "quote_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "quote_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "provider_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "failure_code" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "failure_message" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "funding_transaction_xdr" text;--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT IF EXISTS "payout_provider_transaction_unique";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payout" ADD CONSTRAINT "payout_provider_transaction_unique" UNIQUE("provider","provider_transaction_id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payout" ADD CONSTRAINT "crypto_or_fiat_constraint" CHECK (("payout"."method" = 'crypto' AND "payout"."selected_asset_code" IS NOT NULL AND ("payout"."transaction_hash" IS NOT NULL OR "payout"."status" = 'pending')) OR ("payout"."method" = 'fiat' AND "payout"."selected_asset_code" IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;