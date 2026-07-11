"use server";

import { Pool } from "pg";

export type FilterOp = "eq" | "is_not" | "gt" | "lt" | "gte" | "lte";

export type PropertyFilter = {
  prop: string;
  op: FilterOp;
  value: string | number;
  currency?: string;
};

export type TimeWindow = { amount: number; unit: "days" | "weeks" | "months" } | null;

export type RuleBlock = {
  id: string;
  event: string;
  filters: PropertyFilter[];
  window: TimeWindow;
  count: { op: "gte" | "lte" | "eq"; value: number };
};

export type Cohort = {
  id: string;
  installationId: string;
  name: string;
  description?: string;
  match: "all" | "any";
  blocks: RuleBlock[];
  posthogCohortId: string | null;
  createdAt: string;
  updatedAt: string;
};

const pool = new Pool({ connectionString: process.env.POSTHOG_APP_DATABASE_URL });

async function query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

type CohortRow = {
  id: string;
  installation_id: string;
  name: string;
  description: string | null;
  match: "all" | "any";
  blocks: RuleBlock[];
  posthog_cohort_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToCohort(r: CohortRow): Cohort {
  return {
    id: r.id,
    installationId: r.installation_id,
    name: r.name,
    description: r.description ?? undefined,
    match: r.match,
    blocks: r.blocks,
    posthogCohortId: r.posthog_cohort_id,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listCohorts(installationId: string): Promise<Cohort[]> {
  const rows = await query<CohortRow>(
    `SELECT * FROM cohorts WHERE installation_id = $1 ORDER BY updated_at DESC`,
    [installationId]
  );
  return rows.map(rowToCohort);
}

export async function getCohort(id: string): Promise<Cohort | null> {
  const rows = await query<CohortRow>(`SELECT * FROM cohorts WHERE id = $1`, [id]);
  return rows[0] ? rowToCohort(rows[0]) : null;
}

export async function upsertCohort(cohort: Cohort): Promise<void> {
  await query(
    `INSERT INTO cohorts (id, installation_id, name, description, match, blocks, posthog_cohort_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       match = EXCLUDED.match,
       blocks = EXCLUDED.blocks,
       posthog_cohort_id = EXCLUDED.posthog_cohort_id,
       updated_at = NOW()`,
    [cohort.id, cohort.installationId, cohort.name, cohort.description ?? null, cohort.match, JSON.stringify(cohort.blocks), cohort.posthogCohortId]
  );
}

export async function deleteCohort(id: string): Promise<void> {
  await query(`DELETE FROM cohorts WHERE id = $1`, [id]);
}
