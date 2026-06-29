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
ALTER TABLE "shopify_shop" ADD CONSTRAINT "shopify_shop_stellartools_org_id_organization_id_fk" FOREIGN KEY ("stellartools_org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;