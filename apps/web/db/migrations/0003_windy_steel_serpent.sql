ALTER TABLE "delivery_log" DROP CONSTRAINT "delivery_log_webhook_id_webhook_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE cascade ON UPDATE no action;