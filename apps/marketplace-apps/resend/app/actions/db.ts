import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.RESEND_APP_DATABASE_URL });

async function query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export async function indexEmail(emailId: string, orgId: string): Promise<void> {
  await query(`INSERT INTO email_index (email_id, org_id) VALUES ($1, $2) ON CONFLICT (email_id) DO NOTHING`, [
    emailId,
    orgId,
  ]);
}

export async function getIndexedEmailIds(orgId: string, since: Date): Promise<Set<string>> {
  const rows = await query<{ email_id: string }>(
    `SELECT email_id FROM email_index WHERE org_id = $1 AND sent_at >= $2`,
    [orgId, since]
  );
  return new Set(rows.map((r) => r.email_id));
}
