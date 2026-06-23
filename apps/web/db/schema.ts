import {
  AssetCode,
  AssetIssuer,
  AuthProvider,
  authProviderEnum as authProviderEnum$1,
  networkEnum as networkEnum$1,
  paymentStatusEnum as paymentStatusEnum$1,
  payoutStatusEnum as payoutStatusEnum$1,
} from "@/constant/schema.client";
import { type AppManifest, type AppScope, eventTypeEnum as eventTypeEnum$1 } from "@stellartools/app-sdk/schema";
import {
  AppInstallationSettingValue,
  ProductStatus,
  ProductType,
  SubscriptionData,
  WebhookEventType,
  checkoutStatusEnum as checkoutStatusEnum$1,
  productStatusEnum as productStatusEnum$1,
  productTypeEnum as productTypeEnum$1,
  recurringPeriodEnum as recurringPeriodEnum$1,
  refundStatusEnum as refundStatusEnum$1,
  subscriptionStatusEnum as subscriptionStatusEnum$1,
} from "@stellartools/core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const networkEnum = pgEnum("network", networkEnum$1);

export const authProviderEnum = pgEnum("auth_provider", authProviderEnum$1);

export type AccountSSOOption = {
  provider: AuthProvider;
  sub: string;
};

export type AccountProfile = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export type AccountMetadata = {
  pending2faSecret?: string;
};

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  profile: jsonb("profile").$type<AccountProfile>(),
  sso: jsonb("sso").$type<{ values: Array<AccountSSOOption> }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<AccountMetadata | null>(),
  $2faSecret: text("$2fa_secret"),
});

export const auth = pgTable("auth", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  provider: authProviderEnum("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
});

export const organizations = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    phoneNumber: text("phone_number"),
    address: text("address"),
    socialLinks: jsonb("social_links").$type<Record<string, string> | null>(),
    settings: jsonb("settings").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    supportEmail: text("support_email"),
    payoutAssetCode: text("payout_asset_code").$type<AssetCode>().default("USDC"),
    payoutAssetIssuer: text("payout_asset_issuer"),
    payoutFiatOptions: jsonb("payout_fiat_options").$type<Record<string, unknown> | null>(),
    selectedCurrency: text("selected_currency").notNull(),
  },
  (table) => ({
    idxOrgCreatedAt: index("idx_org_created_at").on(table.accountId, table.createdAt),
  })
);

export const organizationSecrets = pgTable("organization_secret", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  testnetSecretEncrypted: text("testnet_secret_encrypted"),
  testnetSecretVersion: integer("testnet_secret_version")
    .notNull()
    .default(parseInt(process.env.ENCRYPTION_KEY_VERSION!)),
  testnetPublicKey: text("testnet_public_key"),
  mainnetSecretEncrypted: text("mainnet_secret_encrypted"),
  mainnetSecretVersion: integer("mainnet_secret_version")
    .notNull()
    .default(parseInt(process.env.ENCRYPTION_KEY_VERSION!)),
  mainnetPublicKey: text("mainnet_public_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const secretAccessLogActionEnum = pgEnum("secret_access_log_action", ["decrypt", "rotate", "backup"]);

export const secretAccessLog = pgTable("secret_access_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  secretId: text("secret_id")
    .notNull()
    .references(() => organizationSecrets.id),
  action: secretAccessLogActionEnum("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  environment: networkEnum("network").notNull(),
});

export const apiKeys = pgTable("api_key", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  scope: jsonb("scope").$type<string[]>().notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  environment: networkEnum("network").notNull(),
});

export type AssetMetadata = {
  coingeckoId?: string; // CoinGecko coin ID — drives live crypto price lookup
  usdPeg?: true; // Pegged 1:1 to USD (e.g. USDC, USDT)
  fiatPeg?: string; // Pegged to a fiat currency, ISO 4217 (e.g. "EUR" for EURC)
};

export const supportedAssets = pgTable(
  "supported_asset",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().$type<AssetCode>(),
    canonicalIssuer: text("canonical_issuer").$type<AssetIssuer>(),
    description: text("description"),
    environment: networkEnum("network").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<AssetMetadata | null>(),
    images: text("images").array(),
  },
  (table) => ({
    uniqueCodeIssuerEnvironment: unique().on(table.code, table.canonicalIssuer, table.environment),
  })
);

export type CustomerMetadata = Record<string, string>;

export type CustomerWalletAddress = {
  address: string;
  memo?: string;
};

export const customers = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email"),
    name: text("name"),
    phone: text("phone"),
    image: text("image"),
    metadata: jsonb("metadata").$type<CustomerMetadata | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    environment: networkEnum("network").notNull(),
  },
  (table) => ({
    uniqueOrgEmail: unique().on(table.organizationId, table.email),
    uniqueOrgPhone: unique().on(table.organizationId, table.phone),
    idxOrgEnv: index("idx_customer_org_env").on(table.organizationId, table.environment),
    idxOrgCreatedAt: index("idx_customer_org_created_at").on(table.organizationId, table.createdAt),
  })
);

export const customerWallets = pgTable(
  "customer_wallet",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    address: text("address").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    environment: networkEnum("network").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWallet: unique().on(table.customerId, table.address),
    paymentWallet: index("idx_payment_wallet").on(table.customerId, table.address),
  })
);

export const customersRelations = relations(customers, ({ many }) => ({
  wallets: many(customerWallets),
}));

export const customerWalletsRelations = relations(customerWallets, ({ one }) => ({
  customer: one(customers, {
    fields: [customerWallets.customerId],
    references: [customers.id],
  }),
}));

export const productStatusEnum = pgEnum("product_status", productStatusEnum$1.enum);

export const recurringPeriodEnum = pgEnum("recurring_period", recurringPeriodEnum$1.enum);

export const productTypeEnum = pgEnum("product_type", productTypeEnum$1.enum);

export const products = pgTable("product", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  type: productTypeEnum("type").notNull().default("one_time"),
  recurringPeriod: recurringPeriodEnum("recurring_period"),
  customDurationMs: bigint("custom_duration_ms", { mode: "number" }),
  status: productStatusEnum("status").notNull().default("active"),
  images: text("images").array(),
  metadata: jsonb("metadata").$type<Record<string, string> | null>(),
  unit: text("unit"),
  totalCredits: integer("total_credits"),
  unitsPerCredit: integer("units_per_credit"),
  environment: networkEnum("environment").notNull().default("testnet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const checkoutStatusEnum = pgEnum("checkout_status", checkoutStatusEnum$1.enum);

export const checkouts = pgTable(
  "checkout",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: text("customer_id").references(() => customers.id),
    productId: text("product_id").references(() => products.id),
    amountCents: integer("amount_cents"), // $10.00 = 1000
    currencyCode: text("currency_code"),
    description: text("description"),
    status: checkoutStatusEnum("status").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    environment: networkEnum("network").notNull(),
    redirectUrl: text("redirect_url"),
    /**
     * @overrides the customer email and phone number from the customer profile
     * or makes a new customer with the given email and phone number
     */
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    subscriptionData: jsonb("subscription_data").$type<SubscriptionData | null>(),
    initialPagingToken: text("initial_paging_token"),
  },
  (table) => ({
    amountOrProductCheck: check(
      "amount_or_product_check",
      sql`(${table.productId} IS NOT NULL OR (${table.amountCents} IS NOT NULL AND ${table.currencyCode} IS NOT NULL))`
    ),
  })
);

export const subscriptionStatusEnum = pgEnum("subscription_status", subscriptionStatusEnum$1.enum);

export const subscriptions = pgTable("subscription", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  status: subscriptionStatusEnum("status").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at"),
  pausedAt: timestamp("paused_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  environment: networkEnum("network").notNull(),
  trialDays: integer("trial_days").default(0),
  customerWalletId: text("customer_wallet_id").references(() => customerWallets.id),
});

export const paymentStatusEnum = pgEnum("payment_status", paymentStatusEnum$1);

export const payments = pgTable("payment", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  checkoutId: text("checkout_id").references(() => checkouts.id),
  customerId: text("customer_id").references(() => customers.id),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),
  customerWalletId: text("customer_wallet_id").references(() => customerWallets.id),
  creditBalanceId: text("credit_balance_id"),
  productId: text("product_id").references(() => products.id),
  amountCents: integer("amount_cents").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  cryptoAmount: text("crypto_amount").notNull(), // "81.2345678" - what was actually sent
  selectedAssetCode: text("selected_asset_code").notNull(), // "XLM", "USDC", "EURC"
  selectedAssetIssuer: text("selected_asset_issuer"), // null for native XLM
  transactionHash: text("tx_hash").notNull().unique(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  failureReason: text("failure_reason"),
  environment: networkEnum("network").notNull().default("testnet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chargeTypeEnum = pgEnum("charge_type", ["platform_fee", "payout_fee"]);

export const chargeStatusEnum = pgEnum("charge_status", ["pending", "succeeded", "failed"]);

export const charges = pgTable("charge", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  paymentId: text("payment_id").references(() => payments.id),
  amountCents: integer("amount_cents").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  cryptoAmount: text("crypto_amount").notNull(), // "81.2345678" - what was actually sent
  selectedAssetCode: text("selected_asset_code").$type<AssetCode>(),
  selectedAssetIssuer: text("selected_asset_issuer"),
  type: chargeTypeEnum("type").notNull(),
  status: chargeStatusEnum("status").notNull(),
  transactionHash: text("tx_hash"),
  error: text("error"),
  environment: networkEnum("network").notNull(),
  clearedAt: timestamp("cleared_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutStatusEnum = pgEnum("payout_status", payoutStatusEnum$1);

export const payouts = pgTable(
  "payout",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    amountCents: integer("amount_cents").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    cryptoAmount: text("crypto_amount").notNull(),
    selectedAssetCode: text("selected_asset_code").$type<AssetCode>(),
    selectedAssetIssuer: text("selected_asset_issuer"),
    status: payoutStatusEnum("status").notNull(),
    walletAddress: text("wallet_address"),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    environment: networkEnum("network").notNull(),
    transactionHash: text("transaction_hash").unique(),
    bankAccount: jsonb("bank_account").$type<Record<string, unknown> | null>(), // withdawal receipts, account number etc.
  },
  (table) => ({
    cryptoOrFiatConstraint: check(
      "crypto_or_fiat_constraint",
      sql`(${table.selectedAssetCode} IS NOT NULL AND ${table.transactionHash} IS NOT NULL) OR (${table.bankAccount} IS NOT NULL)`
    ),
  })
);

export const webhooks = pgTable("webhook", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().$type<Array<WebhookEventType>>().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDisabled: boolean("is_disabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  environment: networkEnum("network").notNull(),
});

export const webhookLogs = pgTable("webhook_log", {
  id: text("id").primaryKey(),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhooks.id),
  organizationId: text("organization_id").references(() => organizations.id),
  appInstallationId: text("app_installation_id").references(() => appInstallations.id),
  eventType: text("event_type").notNull(),
  request: jsonb("request").$type<unknown>().notNull(),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  responseTime: integer("response_time"), // in milliseconds
  response: jsonb("response").$type<Record<string, unknown> | null>(),
  apiVersion: text("api_version").notNull(),
  environment: networkEnum("network").notNull(),
  nextRetry: timestamp("next_retry"),
  description: text("description").notNull(),
});

export const refundStatusEnum = pgEnum("refund_status", refundStatusEnum$1.enum);

export const refunds = pgTable(
  "refund",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: text("customer_id").references(() => customers.id),
    amountCents: integer("amount_cents").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    cryptoAmount: text("crypto_amount").notNull(),
    selectedAssetCode: text("selected_asset_code").notNull(),
    selectedAssetIssuer: text("selected_asset_issuer"),
    receiverWalletAddress: text("receiver_wallet_address").notNull(),
    transactionHash: text("tx_hash"),
    status: refundStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    environment: networkEnum("network").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  },
  (table) => ({
    uniqueSucceededRefund: uniqueIndex("unique_succeeded_refund")
      .on(table.paymentId, table.customerId)
      .where(sql`status = 'succeeded'`),
  })
);

export const creditBalances = pgTable(
  "credit_balance",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: text("customer_id").references(() => customers.id),
    productId: text("product_id").references(() => products.id),
    environment: networkEnum("network").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    granted: integer("granted").notNull().default(0),
    consumed: integer("consumed").notNull().default(0),
    balance: integer("balance").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
  },
  (table) => ({
    // One balance per customer per product
    uniqueCustomerProduct: unique().on(table.customerId, table.productId, table.environment),
    balanceIndex: index("credit_balance_customer_idx").on(table.customerId, table.organizationId),
  })
);

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", ["deduct", "refund", "grant"]);

export const creditTransactions = pgTable(
  "credit_transaction",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: text("customer_id").references(() => customers.id),
    productId: text("product_id").references(() => products.id),
    balanceId: text("balance_id")
      .notNull()
      .references(() => creditBalances.id),
    environment: networkEnum("network").notNull(),
    amount: integer("amount").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason"),
    type: creditTransactionTypeEnum("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("credit_tx_customer_idx").on(table.customerId, table.productId),
    balanceIdx: index("credit_tx_balance_idx").on(table.balanceId),
    createdAtIdx: index("credit_tx_created_at_idx").on(table.createdAt),
  })
);

export const passwordReset = pgTable(
  "password_reset",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIndex: index("password_reset_token_idx").on(table.token),
  })
);

export const eventTypeEnum = pgEnum("event_type", eventTypeEnum$1 as unknown as readonly [string, ...string[]]);
export const events = pgTable("event", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  environment: networkEnum("network").notNull(),
  type: eventTypeEnum("type").notNull(),

  customerId: text("customer_id").references(() => customers.id), // for end users
  merchantId: text("merchant_id").references(() => organizations.id), // for merchants
  subscriptionId: text("subscription_id").references(() => subscriptions.id), // for subscriptions

  // Payload for the timeline UI (e.g., { "amount": 50, "currency": "USD" })
  data: jsonb("data").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerPortalSessions = pgTable(
  "customer_portal_session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    environment: networkEnum("network").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index("customer_portal_session_token_idx").on(table.token),
  })
);

export const appStatusEnum = pgEnum("app_status", ["available", "coming_soon"]);

export type AppStatus = (typeof appStatusEnum.enumValues)[number];

export const apps = pgTable(
  "app",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(), // "first-promoter", "resend"
    baseUrl: text("base_url").notNull(), // https://app.firstpromoter.com/st-bridge
    appSecret: text("app_secret").notNull(), // Used to sign App Tokens and Webhooks
    webhookUrl: text("webhook_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    publisher: text("publisher").notNull(),
    featuresMarkdown: text("features_markdown").notNull(),
    price: text("price"),
    tagline: text("tagline").notNull(),
    websiteUrl: text("website_url"),
    supportEmail: text("support_email"),
    manifest: jsonb("manifest").$type<AppManifest>().notNull(),
    status: appStatusEnum("status").default("coming_soon"),
    iconUrl: text("icon_url"),
  },
  (table) => ({
    slugIdx: index("app_slug_idx").on(table.slug),
  })
);

export const appInstallationStatusEnum = pgEnum("app_installation_status", ["active", "suspended"]);

export type AppInstallationStatus = (typeof appInstallationStatusEnum.enumValues)[number];

export const appInstallations = pgTable(
  "app_installation",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    environment: networkEnum("network").notNull(),

    // Settings specific to this integration (e.g. { "apiKey": "fp_123" })
    settings: jsonb("settings").$type<Record<string, AppInstallationSettingValue>>().default({}),
    scopes: text("scopes").array().$type<AppScope[]>().notNull(),
    status: appInstallationStatusEnum("status").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueInstallation: unique().on(table.appId, table.organizationId, table.environment),
    idxOrgEnv: index("idx_app_inst_org_env").on(table.organizationId, table.environment),
  })
);

export const appLogs = pgTable("app_log", {
  id: text("id").primaryKey(),
  installationId: text("installation_id")
    .notNull()
    .references(() => appInstallations.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  action: text("action").notNull(),
  statusCode: text("status_code"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Account = InferSelectModel<typeof accounts>;
export type Organization = InferSelectModel<typeof organizations>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type SupportedAsset = InferSelectModel<typeof supportedAssets>;
export type Customer = InferSelectModel<typeof customers>;
export type CustomerWallet = InferSelectModel<typeof customerWallets>;
export type Product = InferSelectModel<typeof products>;
export type Checkout = InferSelectModel<typeof checkouts>;
export type Payment = InferSelectModel<typeof payments>;
export type Webhook = InferSelectModel<typeof webhooks>;
export type WebhookLog = InferSelectModel<typeof webhookLogs>;
export type Network = (typeof networkEnum.enumValues)[number];
export type Refund = InferSelectModel<typeof refunds>;
export type CreditBalance = InferSelectModel<typeof creditBalances>;
export type CreditTransaction = InferSelectModel<typeof creditTransactions>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type Auth = InferSelectModel<typeof auth>;
export type PasswordReset = InferSelectModel<typeof passwordReset>;
export type SecretAccessLog = InferSelectModel<typeof secretAccessLog>;
export type OrganizationSecret = InferSelectModel<typeof organizationSecrets>;
export type Payout = InferSelectModel<typeof payouts>;
export type Event = InferSelectModel<typeof events>;
export type CustomerPortalSession = InferSelectModel<typeof customerPortalSessions>;
export type App = InferSelectModel<typeof apps>;
export type AppInstallation = InferSelectModel<typeof appInstallations>;
export type AppLog = InferSelectModel<typeof appLogs>;

export type ResolvedCustomer = Customer & { wallets?: Array<CustomerWallet> };

export type ResolvedPayment = Payment & {
  refunded: boolean;
  wallets?: CustomerWallet | null;
  refunds?: Refund | null;
  customer?: Customer | null;
  org?: Organization | null;
};

export type ResolvedSubscription = Subscription & {
  customer?: Customer | null;
  product?: Product | null;
  customerWallet?: CustomerWallet | null;
};

export type { ProductStatus, ProductType };
