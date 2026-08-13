ALTER TYPE "public"."subscription_status" ADD VALUE 'overdue' BEFORE 'canceled';--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "invoice_token" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_invoice_token_unique" UNIQUE("invoice_token");