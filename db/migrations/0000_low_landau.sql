CREATE TYPE "public"."app_installation_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('google', 'local');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('platform_fee', 'payout_fee');--> statement-breakpoint
CREATE TYPE "public"."checkout_status" AS ENUM('open', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('deduct', 'refund', 'grant');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('customer::created', 'customer::updated', 'payment::completed', 'payment::failed', 'checkout::created', 'checkout::updated', 'subscription::created', 'subscription::updated', 'subscription::deleted', 'subscription::canceled', 'refund::created', 'refund::failed', 'payout::requested', 'payout::processed', 'payment_method::created', 'payment_method::deleted', 'customer_portal_session::created');--> statement-breakpoint
CREATE TYPE "public"."network" AS ENUM('testnet', 'mainnet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('one_time', 'subscription', 'metered');--> statement-breakpoint
CREATE TYPE "public"."recurring_period" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."secret_access_log_action" AS ENUM('decrypt', 'rotate', 'backup');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"profile" jsonb,
	"sso" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
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
	"manifest" jsonb,
	CONSTRAINT "app_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "asset" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"issuer" text,
	"network" "network" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "asset_code_issuer_network_unique" UNIQUE("code","issuer","network")
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
	"amount" bigint NOT NULL,
	"amount_usd_cents" bigint NOT NULL,
	"asset_id" text NOT NULL,
	"type" charge_type NOT NULL,
	"status" charge_status NOT NULL,
	"tx_hash" text,
	"error" text,
	"network" "network" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"product_id" text,
	"amount" bigint,
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
	"asset_code" text,
	CONSTRAINT "amount_or_product_check" CHECK ("checkout"."product_id" IS NOT NULL OR "checkout"."amount" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "credit_balance" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"product_id" text,
	"network" "network" NOT NULL,
	"metadata" jsonb,
	"balance" bigint DEFAULT 0::bigint NOT NULL,
	"consumed" bigint DEFAULT 0::bigint NOT NULL,
	"granted" bigint DEFAULT 0::bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "credit_balance_customer_id_product_id_network_unique" UNIQUE("customer_id","product_id","network")
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"product_id" text,
	"balance_id" text NOT NULL,
	"network" "network" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reason" text,
	"type" "credit_transaction_type" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"testnet_secret_version" integer DEFAULT null NOT NULL,
	"testnet_public_key" text,
	"mainnet_secret_encrypted" text,
	"mainnet_secret_version" integer DEFAULT null NOT NULL,
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
	"support_email" text
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
	"amount" bigint NOT NULL,
	"amount_usd_cents_snapshot" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"status" "payment_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"network" "network" NOT NULL,
	"customer_wallet_id" text,
	"asset_id" text,
	"subscription_id" text,
	"credit_balance_id" text,
	"metadata" jsonb,
	CONSTRAINT "payment_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" "payout_status" NOT NULL,
	"wallet_address" text,
	"asset" text,
	"memo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"transaction_hash" text,
	"stringified_bank_account" text,
	"withdrawal_receipt_url" text,
	CONSTRAINT "payout_transaction_hash_unique" UNIQUE("transaction_hash"),
	CONSTRAINT "asset_or_stringified_bank_account_check" CHECK ("payout"."asset" IS NOT NULL OR "payout"."stringified_bank_account" IS NOT NULL),
	CONSTRAINT "transaction_hash_or_withdrawal_receipt_url_check" CHECK ("payout"."transaction_hash" IS NOT NULL OR "payout"."withdrawal_receipt_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"images" text[],
	"status" "product_status" NOT NULL,
	"asset_id" text NOT NULL,
	"asset_code" text,
	"type" "product_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"network" "network" NOT NULL,
	"price_amount" bigint NOT NULL,
	"recurring_period" "recurring_period",
	"unit" text,
	"units_per_credit" bigint,
	"total_credits" bigint
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"customer_id" text,
	"amount" bigint NOT NULL,
	"reason" text,
	"status" "refund_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"network" "network" NOT NULL,
	"metadata" jsonb,
	"receiver_public_key" text NOT NULL,
	"asset_code" text
);
--> statement-breakpoint
CREATE TABLE "secret_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"secret_id" text NOT NULL,
	"action" "secret_access_log_action" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"network" "network" NOT NULL
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
CREATE TABLE "webhook_log" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
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
	"description" text NOT NULL
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
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_installation" ADD CONSTRAINT "app_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_log" ADD CONSTRAINT "app_log_installation_id_app_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_log" ADD CONSTRAINT "app_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth" ADD CONSTRAINT "auth_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_balance_id_credit_balance_id_fk" FOREIGN KEY ("balance_id") REFERENCES "public"."credit_balance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_session" ADD CONSTRAINT "customer_portal_session_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_session" ADD CONSTRAINT "customer_portal_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet" ADD CONSTRAINT "customer_wallet_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallet" ADD CONSTRAINT "customer_wallet_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_merchant_id_organization_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_secret" ADD CONSTRAINT "organization_secret_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_checkout_id_checkout_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_customer_wallet_id_customer_wallet_id_fk" FOREIGN KEY ("customer_wallet_id") REFERENCES "public"."customer_wallet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_credit_balance_id_credit_balance_id_fk" FOREIGN KEY ("credit_balance_id") REFERENCES "public"."credit_balance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_asset_asset_id_fk" FOREIGN KEY ("asset") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_access_log" ADD CONSTRAINT "secret_access_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_access_log" ADD CONSTRAINT "secret_access_log_secret_id_organization_secret_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."organization_secret"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_wallet_id_customer_wallet_id_fk" FOREIGN KEY ("customer_wallet_id") REFERENCES "public"."customer_wallet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_app_installation_id_app_installation_id_fk" FOREIGN KEY ("app_installation_id") REFERENCES "public"."app_installation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_inst_org_env" ON "app_installation" USING btree ("organization_id","network");--> statement-breakpoint
CREATE INDEX "credit_balance_customer_idx" ON "credit_balance" USING btree ("customer_id","organization_id");--> statement-breakpoint
CREATE INDEX "credit_tx_customer_idx" ON "credit_transaction" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE INDEX "credit_tx_balance_idx" ON "credit_transaction" USING btree ("balance_id");--> statement-breakpoint
CREATE INDEX "credit_tx_created_at_idx" ON "credit_transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_portal_session_token_idx" ON "customer_portal_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_payment_wallet" ON "customer_wallet" USING btree ("customer_id","address");--> statement-breakpoint
CREATE INDEX "idx_customer_org_env" ON "customer" USING btree ("organization_id","network");--> statement-breakpoint
CREATE INDEX "idx_customer_org_created_at" ON "customer" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_org_created_at" ON "organization" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_token_idx" ON "password_reset" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_succeeded_refund" ON "refund" USING btree ("payment_id","customer_id") WHERE status = 'succeeded';