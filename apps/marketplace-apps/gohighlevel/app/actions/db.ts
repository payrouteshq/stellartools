"use server";

import { Network } from "@stellartools/core";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.GHL_APP_DATABASE_URL });

async function query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

function encryptionKey(): Buffer {
  const key = process.env.GHL_APP_ENCRYPTION_KEY;
  if (!key) throw new Error("GHL_APP_ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, ciphertextHex] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}

export interface GhlLocation {
  location_id: string;
  company_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  provider_registered_at: Date | null;
}

export async function upsertLocationTokens(
  locationId: string,
  companyId: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  await query(
    `INSERT INTO ghl_locations (location_id, company_id, access_token, refresh_token, token_expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location_id) DO UPDATE SET
       company_id = EXCLUDED.company_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [locationId, companyId, accessToken, refreshToken, expiresAt]
  );
}

export async function getLocation(locationId: string): Promise<GhlLocation | null> {
  const [row] = await query<GhlLocation>(`SELECT * FROM ghl_locations WHERE location_id = $1`, [locationId]);
  return row ?? null;
}

export async function markProviderRegistered(locationId: string): Promise<void> {
  await query(`UPDATE ghl_locations SET provider_registered_at = NOW() WHERE location_id = $1`, [locationId]);
}

export async function deleteLocation(locationId: string): Promise<void> {
  await query(`DELETE FROM ghl_locations WHERE location_id = $1`, [locationId]);
}

export interface GhlCredentials {
  ghlSecret: string;
  locationId: string;
  environment: Network;
  stellarApiKey: string;
  publishableKey: string;
  webhookId: string | null;
  webhookSecret: string | null;
}

interface CredentialsRow {
  ghl_secret: string;
  location_id: string;
  environment: Network;
  stellar_api_key_encrypted: string;
  publishable_key: string;
  webhook_id: string | null;
  webhook_secret_encrypted: string | null;
}

function mapCredentialsRow(row: CredentialsRow): GhlCredentials {
  return {
    ghlSecret: row.ghl_secret,
    locationId: row.location_id,
    environment: row.environment,
    stellarApiKey: decrypt(row.stellar_api_key_encrypted),
    publishableKey: row.publishable_key,
    webhookId: row.webhook_id,
    webhookSecret: row.webhook_secret_encrypted ? decrypt(row.webhook_secret_encrypted) : null,
  };
}

function toEnvironment(mode: "test" | "live"): Network {
  return mode === "live" ? "mainnet" : "testnet";
}

export async function saveCredentials(
  locationId: string,
  mode: "test" | "live",
  stellarApiKey: string
): Promise<{ ghlSecret: string; publishableKey: string }> {
  const environment = toEnvironment(mode);
  const [existing] = await query<{ ghl_secret: string; publishable_key: string }>(
    `SELECT ghl_secret, publishable_key FROM ghl_credentials WHERE location_id = $1 AND environment = $2`,
    [locationId, environment]
  );

  const ghlSecret = existing?.ghl_secret ?? `ghlst_${randomBytes(24).toString("hex")}`;
  const publishableKey = existing?.publishable_key ?? `pk_${mode}_${locationId}`;
  const encrypted = encrypt(stellarApiKey);

  await query(
    `INSERT INTO ghl_credentials (ghl_secret, location_id, environment, stellar_api_key_encrypted, publishable_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location_id, environment) DO UPDATE SET stellar_api_key_encrypted = EXCLUDED.stellar_api_key_encrypted`,
    [ghlSecret, locationId, environment, encrypted, publishableKey]
  );

  return { ghlSecret, publishableKey };
}

/** Records the StellarTools webhook created for this credential, so `saveCredentials` doesn't create duplicates on re-save. */
export async function saveWebhookRegistration(
  ghlSecret: string,
  webhookId: string,
  webhookSecret: string
): Promise<void> {
  await query(`UPDATE ghl_credentials SET webhook_id = $2, webhook_secret_encrypted = $3 WHERE ghl_secret = $1`, [
    ghlSecret,
    webhookId,
    encrypt(webhookSecret),
  ]);
}

export async function getCredentialsByGhlSecret(ghlSecret: string): Promise<GhlCredentials | null> {
  const [row] = await query<CredentialsRow>(`SELECT * FROM ghl_credentials WHERE ghl_secret = $1`, [ghlSecret]);
  return row ? mapCredentialsRow(row) : null;
}

export async function getCredentialsByPublishableKey(publishableKey: string): Promise<GhlCredentials | null> {
  const [row] = await query<CredentialsRow>(`SELECT * FROM ghl_credentials WHERE publishable_key = $1`, [
    publishableKey,
  ]);
  return row ? mapCredentialsRow(row) : null;
}

export async function getCredentials(locationId: string, environment: Network): Promise<GhlCredentials | null> {
  const [row] = await query<CredentialsRow>(
    `SELECT * FROM ghl_credentials WHERE location_id = $1 AND environment = $2`,
    [locationId, environment]
  );
  return row ? mapCredentialsRow(row) : null;
}

export async function recordCheckout(input: {
  checkoutId: string;
  locationId: string;
  environment: Network;
  ghlTransactionId: string;
  ghlContactId?: string;
  ghlSubscriptionId?: string;
}): Promise<void> {
  await query(
    `INSERT INTO ghl_checkouts (checkout_id, location_id, environment, ghl_transaction_id, ghl_contact_id, ghl_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (checkout_id) DO NOTHING`,
    [
      input.checkoutId,
      input.locationId,
      input.environment,
      input.ghlTransactionId,
      input.ghlContactId ?? null,
      input.ghlSubscriptionId ?? null,
    ]
  );
}

export async function createLocalFallbackCheckout(input: {
  checkoutId: string;
  amountCents: number;
  currencyCode: string;
  environment: Network;
  description: string;
}): Promise<void> {
  await query(
    `INSERT INTO account (id, email, sso) VALUES ('acc_test', 'test@stellartools.dev', '{"values":[]}') ON CONFLICT (id) DO NOTHING`
  );
  await query(
    `INSERT INTO organization (id, account_id, name, selected_currency) VALUES ('org_test', 'acc_test', 'StellarTools Test Merchant', 'USD') ON CONFLICT (id) DO NOTHING`
  );
  await query(
    `INSERT INTO checkout (id, organization_id, amount_cents, currency_code, status, expires_at, network, description)
     VALUES ($1, 'org_test', $2, $3, 'open', NOW() + INTERVAL '24 hours', $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [input.checkoutId, input.amountCents, input.currencyCode, input.environment, input.description]
  );
}

export async function markCheckoutPaid(checkoutId: string, paymentId: string): Promise<void> {
  await query(`UPDATE ghl_checkouts SET payment_id = $2, status = 'completed' WHERE checkout_id = $1`, [
    checkoutId,
    paymentId,
  ]);
}

export interface GhlCheckoutRecord {
  checkout_id: string;
  location_id: string;
  environment: Network;
  ghl_transaction_id: string;
  ghl_contact_id: string | null;
  ghl_subscription_id: string | null;
  payment_id: string | null;
  status: string;
}

export async function getCheckout(checkoutId: string): Promise<GhlCheckoutRecord | null> {
  const [row] = await query<GhlCheckoutRecord>(`SELECT * FROM ghl_checkouts WHERE checkout_id = $1`, [checkoutId]);
  return row ?? null;
}

export async function resolvePaymentId(checkoutId: string): Promise<string | null> {
  const checkout = await getCheckout(checkoutId);
  return checkout?.payment_id ?? null;
}

export async function getSubscriptionProduct(ghlSubscriptionId: string): Promise<string | null> {
  const [row] = await query<{ stellar_product_id: string }>(
    `SELECT stellar_product_id FROM ghl_subscription_products WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId]
  );
  return row?.stellar_product_id ?? null;
}

export async function saveSubscriptionProduct(
  ghlSubscriptionId: string,
  locationId: string,
  environment: Network,
  stellarProductId: string
): Promise<void> {
  await query(
    `INSERT INTO ghl_subscription_products (ghl_subscription_id, location_id, environment, stellar_product_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ghl_subscription_id) DO NOTHING`,
    [ghlSubscriptionId, locationId, environment, stellarProductId]
  );
}

export interface GhlScheduleRecord {
  ghl_subscription_id: string;
  location_id: string;
  environment: Network;
  contact_id: string;
  amount_cents: number;
  currency_code: string;
  interval_days: number;
  status: "scheduled" | "active" | "canceled";
  next_charge_at: Date;
  last_checkout_id: string | null;
}

export async function createSchedule(input: {
  ghlSubscriptionId: string;
  locationId: string;
  environment: Network;
  contactId: string;
  amountCents: number;
  currencyCode: string;
  intervalDays: number;
  nextChargeAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO ghl_subscription_schedules
       (ghl_subscription_id, location_id, environment, contact_id, amount_cents, currency_code, interval_days, next_charge_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (ghl_subscription_id) DO UPDATE SET
       amount_cents = EXCLUDED.amount_cents,
       currency_code = EXCLUDED.currency_code,
       interval_days = EXCLUDED.interval_days,
       next_charge_at = EXCLUDED.next_charge_at,
       updated_at = NOW()`,
    [
      input.ghlSubscriptionId,
      input.locationId,
      input.environment,
      input.contactId,
      input.amountCents,
      input.currencyCode,
      input.intervalDays,
      input.nextChargeAt,
    ]
  );
}

export async function cancelSchedule(ghlSubscriptionId: string): Promise<void> {
  await query(
    `UPDATE ghl_subscription_schedules SET status = 'canceled', updated_at = NOW() WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId]
  );
}

export async function getSchedule(ghlSubscriptionId: string): Promise<GhlScheduleRecord | null> {
  const [row] = await query<GhlScheduleRecord>(
    `SELECT * FROM ghl_subscription_schedules WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId]
  );
  return row ?? null;
}

export async function listDueSchedules(limit = 100): Promise<GhlScheduleRecord[]> {
  return query<GhlScheduleRecord>(
    `SELECT * FROM ghl_subscription_schedules
     WHERE status IN ('scheduled', 'active') AND next_charge_at <= NOW()
     ORDER BY next_charge_at ASC
     LIMIT $1`,
    [limit]
  );
}

export async function advanceSchedule(
  ghlSubscriptionId: string,
  nextChargeAt: Date,
  checkoutId: string
): Promise<void> {
  await query(
    `UPDATE ghl_subscription_schedules
     SET status = 'active', next_charge_at = $2, last_checkout_id = $3, updated_at = NOW()
     WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId, nextChargeAt, checkoutId]
  );
}
