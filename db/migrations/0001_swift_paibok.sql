ALTER TABLE "checkout" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payout" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "price_amount" SET DATA TYPE bigint;