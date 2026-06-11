ALTER TABLE "charge" RENAME COLUMN "amount_usd_cents" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "payment" RENAME COLUMN "amount_usd_cents" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "payout" RENAME COLUMN "amount_usd_cents" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "refund" RENAME COLUMN "amount_usd_cents" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "checkout" DROP CONSTRAINT "amount_or_product_check";--> statement-breakpoint
ALTER TABLE "charge" ADD COLUMN "currency_code" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "currency_code" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "currency_code" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "amount_or_product_check" CHECK (("checkout"."product_id" IS NOT NULL OR ("checkout"."amount_cents" IS NOT NULL AND "checkout"."currency_code" IS NOT NULL)));