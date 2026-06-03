ALTER TABLE "account" RENAME COLUMN "two_factor_secret" TO "$2fa_secret";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "two_factor_enabled";