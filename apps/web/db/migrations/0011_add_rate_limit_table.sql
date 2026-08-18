CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limit_org_idx" ON "rate_limit" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rate_limit_reset_idx" ON "rate_limit" USING btree ("reset_at");