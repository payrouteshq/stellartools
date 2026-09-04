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

export async function postLocation(params: {
  locationId: string;
  companyId?: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  providerRegisteredAt?: Date | null;
}): Promise<void> {
  await query(
    `INSERT INTO ghl_locations (location_id, company_id, access_token, refresh_token, token_expires_at, provider_registered_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (location_id) DO UPDATE SET
       company_id = EXCLUDED.company_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       provider_registered_at = COALESCE(EXCLUDED.provider_registered_at, ghl_locations.provider_registered_at),
       updated_at = NOW()`,
    [
      params.locationId,
      params.companyId ?? null,
      params.accessToken,
      params.refreshToken,
      params.expiresAt,
      params.providerRegisteredAt ?? null,
    ]
  );
}

export async function retrieveLocation(locationId: string): Promise<GhlLocation | null> {
  const [row] = await query<GhlLocation>(`SELECT * FROM ghl_locations WHERE location_id = $1`, [locationId]);
  return row ?? null;
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

export async function postCredentials(params: {
  locationId: string;
  environment: Network;
  stellarApiKey: string;
  publishableKey?: string;
  ghlSecret?: string;
  webhookId?: string;
  webhookSecret?: string;
}): Promise<{ ghlSecret: string; publishableKey: string }> {
  const [existing] = await query<{ ghl_secret: string; publishable_key: string }>(
    `SELECT ghl_secret, publishable_key FROM ghl_credentials WHERE location_id = $1 AND environment = $2`,
    [params.locationId, params.environment]
  );

  const ghlSecret = params.ghlSecret ?? existing?.ghl_secret ?? `ghlst_${randomBytes(24).toString("hex")}`;
  const publishableKey =
    params.publishableKey ?? existing?.publishable_key ?? `pk_${params.environment}_${params.locationId}`;
  const encryptedApiKey = encrypt(params.stellarApiKey);
  const encryptedWebhookSecret = params.webhookSecret ? encrypt(params.webhookSecret) : null;

  await query(
    `INSERT INTO ghl_credentials (ghl_secret, location_id, environment, stellar_api_key_encrypted, publishable_key, webhook_id, webhook_secret_encrypted)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (location_id, environment) DO UPDATE SET
       stellar_api_key_encrypted = EXCLUDED.stellar_api_key_encrypted,
       publishable_key = EXCLUDED.publishable_key,
       webhook_id = COALESCE(EXCLUDED.webhook_id, ghl_credentials.webhook_id),
       webhook_secret_encrypted = COALESCE(EXCLUDED.webhook_secret_encrypted, ghl_credentials.webhook_secret_encrypted)`,
    [
      ghlSecret,
      params.locationId,
      params.environment,
      encryptedApiKey,
      publishableKey,
      params.webhookId ?? null,
      encryptedWebhookSecret,
    ]
  );

  return { ghlSecret, publishableKey };
}

export async function retrieveCredentials(params?: {
  pubKey?: string;
  secret?: string;
  locationId?: string;
  environment?: Network;
}): Promise<GhlCredentials | null> {
  if (params?.secret) {
    const [row] = await query<CredentialsRow>(`SELECT * FROM ghl_credentials WHERE ghl_secret = $1`, [params.secret]);
    return row ? mapCredentialsRow(row) : null;
  }

  if (params?.pubKey) {
    const [row] = await query<CredentialsRow>(`SELECT * FROM ghl_credentials WHERE publishable_key = $1`, [
      params.pubKey,
    ]);
    return row ? mapCredentialsRow(row) : null;
  }

  if (params?.locationId && params?.environment) {
    const [row] = await query<CredentialsRow>(
      `SELECT * FROM ghl_credentials WHERE location_id = $1 AND environment = $2`,
      [params.locationId, params.environment]
    );
    return row ? mapCredentialsRow(row) : null;
  }

  return null;
}

export async function deleteCredentials(params: { locationId: string; environment?: Network }): Promise<void> {
  if (params.environment) {
    await query(`DELETE FROM ghl_credentials WHERE location_id = $1 AND environment = $2`, [
      params.locationId,
      params.environment,
    ]);
  } else {
    await query(`DELETE FROM ghl_credentials WHERE location_id = $1`, [params.locationId]);
  }
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

export async function postCheckout(params: {
  checkoutId: string;
  locationId: string;
  environment: Network;
  ghlTransactionId: string;
  ghlContactId?: string;
  ghlSubscriptionId?: string;
  paymentId?: string;
  status?: string;
}): Promise<void> {
  await query(
    `INSERT INTO ghl_checkouts (checkout_id, location_id, environment, ghl_transaction_id, ghl_contact_id, ghl_subscription_id, payment_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (checkout_id) DO NOTHING`,
    [
      params.checkoutId,
      params.locationId,
      params.environment,
      params.ghlTransactionId,
      params.ghlContactId ?? null,
      params.ghlSubscriptionId ?? null,
      params.paymentId ?? null,
      params.status ?? "open",
    ]
  );
}

export async function retrieveCheckout(checkoutId: string): Promise<GhlCheckoutRecord | null> {
  const [row] = await query<GhlCheckoutRecord>(`SELECT * FROM ghl_checkouts WHERE checkout_id = $1`, [checkoutId]);
  return row ?? null;
}

export async function putCheckout(checkoutId: string, params: { paymentId?: string; status?: string }): Promise<void> {
  await query(
    `UPDATE ghl_checkouts
     SET payment_id = COALESCE($2, payment_id),
         status = COALESCE($3, status)
     WHERE checkout_id = $1`,
    [checkoutId, params.paymentId ?? null, params.status ?? null]
  );
}

export async function resolvePaymentId(checkoutId: string): Promise<string | null> {
  const checkout = await retrieveCheckout(checkoutId);
  return checkout?.payment_id ?? null;
}

export async function retrieveSubscriptionProduct(ghlSubscriptionId: string): Promise<string | null> {
  const [row] = await query<{ stellar_product_id: string }>(
    `SELECT stellar_product_id FROM ghl_subscription_products WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId]
  );
  return row?.stellar_product_id ?? null;
}

export async function postSubscriptionProduct(params: {
  ghlSubscriptionId: string;
  locationId: string;
  environment: Network;
  stellarProductId: string;
}): Promise<void> {
  await query(
    `INSERT INTO ghl_subscription_products (ghl_subscription_id, location_id, environment, stellar_product_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ghl_subscription_id) DO NOTHING`,
    [params.ghlSubscriptionId, params.locationId, params.environment, params.stellarProductId]
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

export async function postSchedule(params: {
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
      params.ghlSubscriptionId,
      params.locationId,
      params.environment,
      params.contactId,
      params.amountCents,
      params.currencyCode,
      params.intervalDays,
      params.nextChargeAt,
    ]
  );
}

export async function retrieveSchedule(ghlSubscriptionId: string): Promise<GhlScheduleRecord | null> {
  const [row] = await query<GhlScheduleRecord>(
    `SELECT * FROM ghl_subscription_schedules WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId]
  );
  return row ?? null;
}

export async function putSchedule(
  ghlSubscriptionId: string,
  params: { status?: "scheduled" | "active" | "canceled"; nextChargeAt?: Date; lastCheckoutId?: string }
): Promise<void> {
  await query(
    `UPDATE ghl_subscription_schedules
     SET status = COALESCE($2, status),
         next_charge_at = COALESCE($3, next_charge_at),
         last_checkout_id = COALESCE($4, last_checkout_id),
         updated_at = NOW()
     WHERE ghl_subscription_id = $1`,
    [ghlSubscriptionId, params.status ?? null, params.nextChargeAt ?? null, params.lastCheckoutId ?? null]
  );
}

export async function retrieveDueSchedules(limit = 100): Promise<GhlScheduleRecord[]> {
  return query<GhlScheduleRecord>(
    `SELECT * FROM ghl_subscription_schedules
     WHERE status IN ('scheduled', 'active') AND next_charge_at <= NOW()
     ORDER BY next_charge_at ASC
     LIMIT $1`,
    [limit]
  );
}
