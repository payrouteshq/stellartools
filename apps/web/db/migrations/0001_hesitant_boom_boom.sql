ALTER TABLE "api_key" DROP CONSTRAINT "api_key_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "app_installation" DROP CONSTRAINT "app_installation_app_id_app_id_fk";
--> statement-breakpoint
ALTER TABLE "app_installation" DROP CONSTRAINT "app_installation_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "app_log" DROP CONSTRAINT "app_log_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "auth" DROP CONSTRAINT "auth_account_id_account_id_fk";
--> statement-breakpoint
ALTER TABLE "charge" DROP CONSTRAINT "charge_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "charge" DROP CONSTRAINT "charge_payment_id_payment_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout" DROP CONSTRAINT "checkout_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout" DROP CONSTRAINT "checkout_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "checkout" DROP CONSTRAINT "checkout_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_portal_session" DROP CONSTRAINT "customer_portal_session_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_portal_session" DROP CONSTRAINT "customer_portal_session_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_wallet" DROP CONSTRAINT "customer_wallet_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_wallet" DROP CONSTRAINT "customer_wallet_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "customer" DROP CONSTRAINT "customer_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_merchant_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_subscription_id_subscription_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_secret" DROP CONSTRAINT "organization_secret_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "organization" DROP CONSTRAINT "organization_account_id_account_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_checkout_id_checkout_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_subscription_id_subscription_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_customer_wallet_id_customer_wallet_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT "payout_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT "product_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "refund" DROP CONSTRAINT "refund_payment_id_payment_id_fk";
--> statement-breakpoint
ALTER TABLE "refund" DROP CONSTRAINT "refund_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "refund" DROP CONSTRAINT "refund_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "secret_access_log" DROP CONSTRAINT "secret_access_log_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "secret_access_log" DROP CONSTRAINT "secret_access_log_secret_id_organization_secret_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_customer_id_customer_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_customer_wallet_id_customer_wallet_id_fk";
--> statement-breakpoint
ALTER TABLE "webhook_log" DROP CONSTRAINT "webhook_log_webhook_id_webhook_id_fk";
--> statement-breakpoint
ALTER TABLE "webhook_log" DROP CONSTRAINT "webhook_log_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "webhook_log" DROP CONSTRAINT "webhook_log_app_installation_id_app_installation_id_fk";
--> statement-breakpoint
ALTER TABLE "webhook" DROP CONSTRAINT "webhook_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_log" ADD CONSTRAINT "app_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth" ADD CONSTRAINT "auth_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_session" ADD CONSTRAINT "customer_portal_session_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_session" ADD CONSTRAINT "customer_portal_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet" ADD CONSTRAINT "customer_wallet_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet" ADD CONSTRAINT "customer_wallet_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_merchant_id_organization_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_secret" ADD CONSTRAINT "organization_secret_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_checkout_id_checkout_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_customer_wallet_id_customer_wallet_id_fk" FOREIGN KEY ("customer_wallet_id") REFERENCES "public"."customer_wallet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_access_log" ADD CONSTRAINT "secret_access_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_access_log" ADD CONSTRAINT "secret_access_log_secret_id_organization_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."organization_secret"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_wallet_id_customer_wallet_id_fk" FOREIGN KEY ("customer_wallet_id") REFERENCES "public"."customer_wallet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_app_installation_id_app_installation_id_fk" FOREIGN KEY ("app_installation_id") REFERENCES "public"."app_installation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "payout_asset_code";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "payout_asset_issuer";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "payout_fiat_options";