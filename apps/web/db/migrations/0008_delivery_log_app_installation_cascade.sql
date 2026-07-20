ALTER TABLE "delivery_log" DROP CONSTRAINT "delivery_log_app_installation_id_app_installation_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_app_installation_id_app_installation_id_fk" FOREIGN KEY ("app_installation_id") REFERENCES "public"."app_installation"("id") ON DELETE cascade ON UPDATE no action;