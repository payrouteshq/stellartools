CREATE TABLE "shopify_payment_session" (
	"shopify_gid" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shop" text NOT NULL,
	"payment_id" text,
	"checkout_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopify_shop" (
	"shop" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"api_key_id" text NOT NULL,
	"network" "network" NOT NULL,
	"access_token" text NOT NULL,
	"asset_code" text DEFAULT 'USDC' NOT NULL,
	"webhook_secret" text DEFAULT '' NOT NULL,
	"debug_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "shopify_payment_session" ADD CONSTRAINT "shopify_payment_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_payment_session" ADD CONSTRAINT "shopify_payment_session_shop_shopify_shop_shop_fk" FOREIGN KEY ("shop") REFERENCES "public"."shopify_shop"("shop") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_payment_session" ADD CONSTRAINT "shopify_payment_session_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_payment_session" ADD CONSTRAINT "shopify_payment_session_checkout_id_checkout_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_shop" ADD CONSTRAINT "shopify_shop_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_shop" ADD CONSTRAINT "shopify_shop_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shopify_payment_session_shop" ON "shopify_payment_session" USING btree ("shop");--> statement-breakpoint
CREATE INDEX "idx_shopify_payment_session_org" ON "shopify_payment_session" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_shopify_payment_session_payment" ON "shopify_payment_session" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_shopify_shop_org_env" ON "shopify_shop" USING btree ("organization_id","network");--> statement-breakpoint
CREATE INDEX "idx_shopify_shop_api_key" ON "shopify_shop" USING btree ("api_key_id");