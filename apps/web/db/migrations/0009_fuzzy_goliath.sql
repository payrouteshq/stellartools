CREATE TYPE "public"."wallet_strategy" AS ENUM('managed', 'direct');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "wallet_strategy" "wallet_strategy" DEFAULT 'managed' NOT NULL;