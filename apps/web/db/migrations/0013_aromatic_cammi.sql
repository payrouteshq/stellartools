-- Platform fee removal: the `charge` table only ever stored StellarTools's own
-- 1% platform fee ledger, which no longer exists.
ALTER TABLE "charge" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "charge" CASCADE;--> statement-breakpoint

-- Pre-existing drift cleanup (unrelated to the fee/wallet-strategy removal above):
-- `supported_asset` was created in the very first migration but dropped from
-- schema.ts long ago without ever generating the matching DROP TABLE migration.
-- It has no live code path (the "retrieve_supported_assets" MCP tool returns a
-- hardcoded USDC entry, it does not query this table) — confirmed dead before
-- writing this migration. Verify it's empty in your database before applying.
ALTER TABLE "supported_asset" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "supported_asset" CASCADE;--> statement-breakpoint

-- Wallet strategy collapse: self-hosted deployments only ever run the
-- server-managed wallet model now — the "direct" (bring-your-own-key,
-- no-server-automation) strategy is removed. Existing "direct" orgs keep
-- their stored public key and keep receiving funds at the same address;
-- they simply lose the option to pick a strategy going forward.
ALTER TABLE "organization" DROP COLUMN "wallet_strategy";--> statement-breakpoint

-- Fiat off-ramp (SEP-24 anchor) removal: payouts are crypto-only now.
ALTER TABLE "payout" DROP CONSTRAINT "payout_provider_transaction_unique";--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT "crypto_or_fiat_constraint";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "method";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "bank_account";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "provider_transaction_id";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "provider_status";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "destination_currency";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "destination_country";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "withdrawal_method";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "quote_id";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "quote_expires_at";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "provider_updated_at";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "failure_code";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "failure_message";--> statement-breakpoint
ALTER TABLE "payout" DROP COLUMN "funding_transaction_xdr";--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_asset_check" CHECK ("payout"."selected_asset_code" IS NOT NULL AND ("payout"."transaction_hash" IS NOT NULL OR "payout"."status" = 'pending'));--> statement-breakpoint
DROP TYPE "public"."charge_status";--> statement-breakpoint
DROP TYPE "public"."charge_type";--> statement-breakpoint
DROP TYPE "public"."payout_method";--> statement-breakpoint
DROP TYPE "public"."wallet_strategy";