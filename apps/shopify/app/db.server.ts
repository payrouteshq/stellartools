import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const client = postgres(process.env.DATABASE_URL!);

// Shopify session storage table (mirrors web app's schema)
export const shopifySessions = pgTable("shopify_session", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  scope: text("scope"),
  expires: timestamp("expires"),
  accessToken: text("access_token"),
  userId: text("user_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  accountOwner: boolean("account_owner").notNull().default(false),
  locale: text("locale"),
  collaborator: boolean("collaborator").default(false),
  emailVerified: boolean("email_verified").default(false),
});

// Shopify shops table (mirrors web app's schema)
export const shopifyShops = pgTable("shopify_shop", {
  id: text("id").primaryKey(),
  shopDomain: text("shop_domain").notNull(),
  accessToken: text("access_token").notNull(),
  stellartoolsOrgId: text("stellartools_org_id"),
  stellartoolsApiKey: text("stellartools_api_key"),
  environment: text("environment")
    .notNull()
    .$type<"testnet" | "mainnet">()
    .default("testnet"),
  settings: jsonb("settings").$type<Record<string, unknown> | null>(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  uninstalledAt: timestamp("uninstalled_at"),
});

export const db = drizzle({
  client,
  schema: { shopifySessions, shopifyShops },
});

export type ShopifyShop = typeof shopifyShops.$inferSelect;
