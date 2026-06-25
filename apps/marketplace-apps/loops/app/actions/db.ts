import { ActivityStats, SendType } from "@/app/types";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.LOOPS_APP_DATABASE_URL });

async function query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export async function logEvent(
  orgId: string,
  environment: string,
  eventType: string,
  email: string,
  sendType: SendType,
  emailConfig: string
): Promise<void> {
  await query(
    `INSERT INTO event_log (org_id, environment, event_type, email, send_type, email_config) VALUES ($1, $2, $3, $4, $5, $6)`,
    [orgId, environment, eventType, email, sendType, emailConfig]
  );
}

export async function getActivityStats(orgId: string, environment: string, periodDays: number): Promise<ActivityStats> {
  const since = new Date(Date.now() - periodDays * 864e5);

  const rows = await query<{
    id: string;
    event_type: string;
    email: string;
    send_type: SendType;
    email_config: string;
    sent_at: string;
  }>(
    `SELECT id, event_type, email, send_type, email_config, sent_at FROM event_log WHERE org_id = $1 AND environment = $2 AND sent_at >= $3 ORDER BY sent_at DESC`,
    [orgId, environment, since]
  );

  return {
    totalSent: rows.length,
    transactionalCount: rows.filter((r) => r.send_type === "transactional").length,
    eventCount: rows.filter((r) => r.send_type === "event").length,
    logs: rows.map((r) => ({
      id: r.id,
      email: r.email,
      eventType: r.event_type,
      sendType: r.send_type,
      emailConfig: r.email_config,
      sentAt: new Date(r.sent_at).toLocaleString(),
    })),
  };
}
