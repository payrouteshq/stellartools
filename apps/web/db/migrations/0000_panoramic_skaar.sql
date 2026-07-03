CREATE TYPE "public"."app_installation_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."app_status" AS ENUM('available', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('google', 'local');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('platform_fee', 'payout_fee');--> statement-breakpoint
CREATE TYPE "public"."checkout_status" AS ENUM('open', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('customer::created', 'customer::updated', 'payment::completed', 'payment::failed', 'checkout::created', 'checkout::updated', 'subscription::created', 'subscription::updated', 'subscription::deleted', 'subscription::canceled', 'refund::created', 'refund::failed', 'payout::requested', 'payout::processed', 'payment_method::created', 'payment_method::deleted', 'customer_portal_session::created');--> statement-breakpoint
CREATE TYPE "public"."network" AS ENUM('testnet', 'mainnet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('one_time', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."recurring_period" AS ENUM('day', 'week', 'month', 'year', 'custom');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"profile" jsonb,
	"sso" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"$2fa_secret" text,
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"scope" jsonb NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	CONSTRAINT "api_key_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "app_installation" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"network" "network" NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"scopes" text[] NOT NULL,
	"status" "app_installation_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_installation_app_id_organization_id_network_unique" UNIQUE("app_id","organization_id","network")
);
--> statement-breakpoint
CREATE TABLE "app_log" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"action" text NOT NULL,
	"status_code" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"base_url" text NOT NULL,
	"app_secret" text NOT NULL,
	"webhook_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"publisher" text NOT NULL,
	"features_markdown" text NOT NULL,
	"price" text,
	"tagline" text NOT NULL,
	"website_url" text,
	"support_email" text,
	"scopes" text[] NOT NULL,
	"sensitiveKeys" text[],
	"version" text NOT NULL,
	"status" "app_status" DEFAULT 'coming_soon',
	"icon_url" text,
	CONSTRAINT "app_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "charge" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" text,
	"amount_cents" integer NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"crypto_amount" text NOT NULL,
	"selected_asset_code" text,
	"selected_asset_issuer" text,
	"type" charge_type NOT NULL,
	"status" charge_status NOT NULL,
	"tx_hash" text,
	"error" text,
	"network" "network" NOT NULL,
	"cleared_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"product_id" text,
	"amount_cents" integer,
	"currency_code" text,
	"description" text,
	"status" "checkout_status" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"redirect_url" text,
	"customer_email" text,
	"customer_phone" text,
	"subscription_data" jsonb,
	"initial_paging_token" text,
	CONSTRAINT "amount_or_product_check" CHECK (("checkout"."product_id" IS NOT NULL OR ("checkout"."amount_cents" IS NOT NULL AND "checkout"."currency_code" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "customer_portal_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"customer_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"network" "network" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_portal_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "customer_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"organization_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_wallet_customer_id_address_unique" UNIQUE("customer_id","address")
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text,
	"name" text,
	"phone" text,
	"image" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"network" "network" NOT NULL,
	CONSTRAINT "customer_organization_id_email_unique" UNIQUE("organization_id","email"),
	CONSTRAINT "customer_organization_id_phone_unique" UNIQUE("organization_id","phone")
);
--> statement-breakpoint
CREATE TABLE "delivery_log" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text,
	"organization_id" text,
	"app_installation_id" text,
	"event_type" text NOT NULL,
	"request" jsonb NOT NULL,
	"status_code" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"response_time" integer,
	"response" jsonb,
	"api_version" text NOT NULL,
	"network" "network" NOT NULL,
	"next_retry" timestamp,
	"description" text NOT NULL,
	CONSTRAINT "delivery_log_source_check" CHECK ("delivery_log"."webhook_id" IS NOT NULL OR "delivery_log"."app_installation_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"network" "network" NOT NULL,
	"type" "event_type" NOT NULL,
	"customer_id" text,
	"merchant_id" text,
	"subscription_id" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_secret" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"testnet_secret_encrypted" text,
	"testnet_public_key" text,
	"mainnet_secret_encrypted" text,
	"mainnet_public_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"phone_number" text,
	"address" text,
	"social_links" jsonb,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"support_email" text,
	"selected_currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"checkout_id" text,
	"customer_id" text,
	"subscription_id" text,
	"customer_wallet_id" text,
	"product_id" text,
	"amount_cents" integer NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"crypto_amount" text NOT NULL,
	"selected_asset_code" text NOT NULL,
	"selected_asset_issuer" text,
	"tx_hash" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"failure_reason" text,
	"network" "network" DEFAULT 'testnet' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"crypto_amount" text NOT NULL,
	"selected_asset_code" text,
	"selected_asset_issuer" text,
	"status" "payout_status" NOT NULL,
	"wallet_address" text,
	"memo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"transaction_hash" text,
	"bank_account" jsonb,
	CONSTRAINT "payout_transaction_hash_unique" UNIQUE("transaction_hash"),
	CONSTRAINT "crypto_or_fiat_constraint" CHECK (("payout"."selected_asset_code" IS NOT NULL AND "payout"."transaction_hash" IS NOT NULL) OR ("payout"."bank_account" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"type" "product_type" DEFAULT 'one_time' NOT NULL,
	"recurring_period" "recurring_period",
	"custom_duration_ms" bigint,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"images" text[],
	"metadata" jsonb,
	"unit" text,
	"environment" "network" DEFAULT 'testnet' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"amount_cents" integer NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"crypto_amount" text NOT NULL,
	"selected_asset_code" text NOT NULL,
	"selected_asset_issuer" text,
	"receiver_wallet_address" text NOT NULL,
	"tx_hash" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"network" "network" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "shopify_session" (
	"id" text PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"state" text NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"scope" text,
	"expires" timestamp,
	"access_token" text,
	"user_id" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"account_owner" boolean DEFAULT false NOT NULL,
	"locale" text,
	"collaborator" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "shopify_shop" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"access_token" text NOT NULL,
	"stellartools_org_id" text,
	"stellartools_api_key" text,
	"environment" "network" DEFAULT 'testnet' NOT NULL,
	"settings" jsonb,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp,
	CONSTRAINT "shopify_shop_shop_domain_unique" UNIQUE("shop_domain")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"organization_id" text NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp,
	"paused_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"trial_days" integer DEFAULT 0,
	"customer_wallet_id" text
);
--> statement-breakpoint
CREATE TABLE "supported_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"canonical_issuer" text,
	"description" text,
	"network" "network" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"images" text[],
	CONSTRAINT "supported_asset_code_canonical_issuer_network_unique" UNIQUE("code","canonical_issuer","network")
);
--> statement-breakpoint
CREATE TABLE "webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text[] NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"network" "network" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_log" ADD CONSTRAINT "app_log_installation_id_app_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
<<<<<<<< Updated upstream:apps/web/db/migrations/0000_overjoyed_warpath.sql
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_app_installation_id_app_installation_id_fk" FOREIGN KEY ("app_installation_id") REFERENCES "public"."app_installation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
========
>>>>>>>> Stashed changes:apps/web/db/migrations/0000_panoramic_skaar.sql
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_merchant_id_organization_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_secret" ADD CONSTRAINT "organization_secret_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "shopify_shop" ADD CONSTRAINT "shopify_shop_stellartools_org_id_organization_id_fk" FOREIGN KEY ("stellartools_org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_wallet_id_customer_wallet_id_fk" FOREIGN KEY ("customer_wallet_id") REFERENCES "public"."customer_wallet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
<<<<<<<< Updated upstream:apps/web/db/migrations/0000_overjoyed_warpath.sql
========
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_app_installation_id_app_installation_id_fk" FOREIGN KEY ("app_installation_id") REFERENCES "public"."app_installation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
>>>>>>>> Stashed changes:apps/web/db/migrations/0000_panoramic_skaar.sql
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_inst_org_env" ON "app_installation" USING btree ("organization_id","network");--> statement-breakpoint
CREATE INDEX "app_slug_idx" ON "app" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "customer_portal_session_token_idx" ON "customer_portal_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_payment_wallet" ON "customer_wallet" USING btree ("customer_id","address");--> statement-breakpoint
CREATE INDEX "idx_customer_org_env" ON "customer" USING btree ("organization_id","network");--> statement-breakpoint
CREATE INDEX "idx_customer_org_created_at" ON "customer" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_org_created_at" ON "organization" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_token_idx" ON "password_reset" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_succeeded_refund" ON "refund" USING btree ("payment_id","customer_id") WHERE status = 'succeeded';