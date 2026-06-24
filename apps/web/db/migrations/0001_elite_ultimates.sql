ALTER TABLE "app" RENAME COLUMN "manifest" TO "scopes";--> statement-breakpoint
ALTER TABLE "app" ADD COLUMN "sensitiveKeys" text[];--> statement-breakpoint
ALTER TABLE "app" ADD COLUMN "version" text NOT NULL;