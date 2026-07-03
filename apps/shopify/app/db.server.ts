import { Session } from "@shopify/shopify-app-remix/server";
import { Network } from "@stellartools/core";
import { nanoid } from "nanoid";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShopRow {
  id: string;
  shop_domain: string;
  access_token: string;
  stellartools_api_key: string | null;
  environment: Network;
  settings: Record<string, unknown> | null;
  installed_at: Date;
  uninstalled_at: Date | null;
  stellartools_webhook_id: string | null;
  stellartools_webhook_secret: string | null;
}

// ─── Shop queries ────────────────────────────────────────────────────────────

export async function getShopByDomain(domain: string): Promise<ShopRow | null> {
  const rows = await query<ShopRow>(`SELECT * FROM shopify_shop WHERE shop_domain = $1 LIMIT 1`, [domain]);
  return rows[0] ?? null;
}

export async function upsertShop(shopDomain: string, accessToken: string): Promise<void> {
  await query(
    `INSERT INTO shopify_shop (id, shop_domain, access_token, environment, installed_at)
     VALUES ($1, $2, $3, 'testnet', NOW())
     ON CONFLICT (shop_domain)
     DO UPDATE SET access_token = EXCLUDED.access_token, uninstalled_at = NULL`,
    [`sh_${nanoid(20)}`, shopDomain, accessToken]
  );
}

export async function updateShopSettings(shopDomain: string, apiKey: string, environment: Network): Promise<void> {
  await query(`UPDATE shopify_shop SET stellartools_api_key = $1, environment = $2 WHERE shop_domain = $3`, [
    apiKey,
    environment,
    shopDomain,
  ]);
}

export async function updateShopWebhook(
  shopDomain: string,
  webhookId: string | null,
  webhookSecret: string | null
): Promise<void> {
  await query(
    `UPDATE shopify_shop SET stellartools_webhook_id = $1, stellartools_webhook_secret = $2 WHERE shop_domain = $3`,
    [webhookId, webhookSecret, shopDomain]
  );
}

export async function markShopUninstalled(shopDomain: string): Promise<void> {
  await query(`UPDATE shopify_shop SET uninstalled_at = NOW() WHERE shop_domain = $1`, [shopDomain]);
}

// ─── Payment sessions ────────────────────────────────────────────────────────

export interface PaymentSessionRow {
  id: string;
  gid: string;
  shop: string;
  stellartools_checkout_id: string | null;
  stellartools_payment_id: string | null;
  amount: string;
  currency: string;
  customer_email: string | null;
  cancel_url: string;
  status: string;
  created_at: Date;
}

export async function createPaymentSession(params: {
  id: string;
  gid: string;
  shop: string;
  amount: string;
  currency: string;
  customerEmail: string | null;
  cancelUrl: string;
  stellartoolsCheckoutId: string;
}): Promise<void> {
  await query(
    `INSERT INTO shopify_payment_sessions
       (id, gid, shop, amount, currency, customer_email, cancel_url, stellartools_checkout_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     ON CONFLICT (id) DO NOTHING`,
    [
      params.id,
      params.gid,
      params.shop,
      params.amount,
      params.currency,
      params.customerEmail,
      params.cancelUrl,
      params.stellartoolsCheckoutId,
    ]
  );
}

export async function updatePaymentSessionPaymentId(checkoutId: string, paymentId: string): Promise<void> {
  await query(`UPDATE shopify_payment_sessions SET stellartools_payment_id = $1 WHERE stellartools_checkout_id = $2`, [
    paymentId,
    checkoutId,
  ]);
}

export async function getPaymentSessionByCheckoutId(checkoutId: string): Promise<PaymentSessionRow | null> {
  const rows = await query<PaymentSessionRow>(
    `SELECT * FROM shopify_payment_sessions WHERE stellartools_checkout_id = $1 LIMIT 1`,
    [checkoutId]
  );
  return rows[0] ?? null;
}

export async function getPaymentSessionById(id: string): Promise<PaymentSessionRow | null> {
  const rows = await query<PaymentSessionRow>(`SELECT * FROM shopify_payment_sessions WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function getPaymentSessionByGid(gid: string): Promise<PaymentSessionRow | null> {
  const rows = await query<PaymentSessionRow>(`SELECT * FROM shopify_payment_sessions WHERE gid = $1 LIMIT 1`, [gid]);
  return rows[0] ?? null;
}

export async function markPaymentSessionResolved(id: string): Promise<void> {
  await query(`UPDATE shopify_payment_sessions SET status = 'resolved' WHERE id = $1`, [id]);
}

export async function createUnstableCheckoutRecord(params: {
  shop: string;
  amount: string;
  currency: string;
  customerEmail: string | null;
  stellartoolsCheckoutId: string;
}): Promise<void> {
  await query(
    `INSERT INTO shopify_payment_sessions
       (id, gid, shop, amount, currency, customer_email, cancel_url, stellartools_checkout_id, status)
     VALUES ($1, '', $2, $3, $4, $5, '', $6, 'pending')
     ON CONFLICT (id) DO NOTHING`,
    [
      `unstable_${nanoid(20)}`,
      params.shop,
      params.amount,
      params.currency,
      params.customerEmail,
      params.stellartoolsCheckoutId,
    ]
  );
}

export async function getCustomerEmailsByShop(shop: string, limit = 30): Promise<string[]> {
  const rows = await query<{ customer_email: string }>(
    `SELECT DISTINCT customer_email
     FROM shopify_payment_sessions
     WHERE shop = $1 AND customer_email IS NOT NULL
     ORDER BY customer_email
     LIMIT $2`,
    [shop, limit]
  );
  return rows.map((r) => r.customer_email);
}

// ─── Refund sessions ─────────────────────────────────────────────────────────

export interface RefundSessionRow {
  id: string;
  gid: string;
  shop: string;
  payment_gid: string;
  stellartools_refund_id: string | null;
  amount: string;
  currency: string;
  status: string;
  created_at: Date;
}

export async function createRefundSession(params: {
  id: string;
  gid: string;
  shop: string;
  paymentGid: string;
  amount: string;
  currency: string;
  stellartoolsRefundId: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO refund_sessions
       (id, gid, shop, payment_gid, amount, currency, stellartools_refund_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
     ON CONFLICT (id) DO NOTHING`,
    [params.id, params.gid, params.shop, params.paymentGid, params.amount, params.currency, params.stellartoolsRefundId]
  );
}

export async function getRefundSessionByStellarRefundId(refundId: string): Promise<RefundSessionRow | null> {
  const rows = await query<RefundSessionRow>(
    `SELECT * FROM refund_sessions WHERE stellartools_refund_id = $1 LIMIT 1`,
    [refundId]
  );
  return rows[0] ?? null;
}

// ─── Session storage (implements Shopify's SessionStorage interface) ─────────

interface SessionRow {
  id: string;
  shop: string;
  state: string;
  is_online: boolean;
  scope: string | null;
  expires: Date | null;
  access_token: string | null;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_owner: boolean;
  locale: string | null;
  collaborator: boolean;
  email_verified: boolean;
}

function rowToSession(row: SessionRow): Session {
  const session = new Session({
    id: row.id,
    shop: row.shop,
    state: row.state,
    isOnline: row.is_online,
  });
  if (row.scope) session.scope = row.scope;
  if (row.expires) session.expires = row.expires;
  if (row.access_token) session.accessToken = row.access_token;
  return session;
}

export class PgSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    await query(
      `INSERT INTO shopify_session
         (id, shop, state, is_online, scope, expires, access_token,
          user_id, first_name, last_name, email, account_owner, locale, collaborator, email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         shop = EXCLUDED.shop, state = EXCLUDED.state, is_online = EXCLUDED.is_online,
         scope = EXCLUDED.scope, expires = EXCLUDED.expires, access_token = EXCLUDED.access_token,
         user_id = EXCLUDED.user_id, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
         email = EXCLUDED.email, account_owner = EXCLUDED.account_owner, locale = EXCLUDED.locale,
         collaborator = EXCLUDED.collaborator, email_verified = EXCLUDED.email_verified`,
      [
        session.id,
        session.shop,
        session.state,
        session.isOnline,
        session.scope ?? null,
        session.expires ?? null,
        session.accessToken ?? null,
        session.onlineAccessInfo?.associated_user?.id?.toString() ?? null,
        session.onlineAccessInfo?.associated_user?.first_name ?? null,
        session.onlineAccessInfo?.associated_user?.last_name ?? null,
        session.onlineAccessInfo?.associated_user?.email ?? null,
        session.onlineAccessInfo?.associated_user?.account_owner ?? false,
        session.onlineAccessInfo?.associated_user?.locale ?? null,
        session.onlineAccessInfo?.associated_user?.collaborator ?? false,
        session.onlineAccessInfo?.associated_user?.email_verified ?? false,
      ]
    );
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const rows = await query<SessionRow>(`SELECT * FROM shopify_session WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? rowToSession(rows[0]) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    await query(`DELETE FROM shopify_session WHERE id = $1`, [id]);
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    await query(`DELETE FROM shopify_session WHERE id IN (${placeholders})`, ids);
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await query<SessionRow>(`SELECT * FROM shopify_session WHERE shop = $1`, [shop]);
    return rows.map(rowToSession);
  }
}
