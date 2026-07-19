ALTER TABLE "customer" DROP CONSTRAINT "customer_organization_id_email_unique";--> statement-breakpoint
ALTER TABLE "customer" DROP CONSTRAINT "customer_organization_id_phone_unique";--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_email_network_unique" UNIQUE("organization_id","email","network");