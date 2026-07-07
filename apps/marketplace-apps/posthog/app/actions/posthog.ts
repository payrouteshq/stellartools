"use server";

import { Cohort, FilterOp, deleteCohort as dbDeleteCohort, upsertCohort } from "@/app/actions/db";
import { Primitive, StellarTools } from "@stellartools/core";

export type PostHogProject = { id: number; name: string };

export type AppSettings = {
  posthogProjectToken: string;
  posthogPersonalApiKey: string;
  posthogProjectId: string;
  posthogHost: string;
};

// ─── PostHog cohort helpers ───────────────────────────────────────────────────

type FilterOpStr = "exact" | "is_not" | "gt" | "lt" | "gte" | "lte";

function mapFilterOp(op: FilterOp): FilterOpStr {
  const map: Record<FilterOp, FilterOpStr> = {
    "=": "exact",
    "!=": "is_not",
    ">": "gt",
    "<": "lt",
    ">=": "gte",
    "<=": "lte",
  };
  return map[op];
}

function compileCohort(cohort: Cohort) {
  return {
    name: cohort.name,
    description: cohort.description ?? "",
    is_static: false,
    filters: {
      properties: {
        type: cohort.match === "all" ? "AND" : "OR",
        values: cohort.blocks.map((block) => ({
          type: "behavioral",
          value: "performed_event",
          key: block.event.replace(/\./g, "_"),
          event_type: "events",
          time_value: block.window?.amount ?? null,
          time_interval: block.window?.unit ?? null,
          operator: block.count.op === "eq" ? "exact" : block.count.op,
          operator_value: block.count.value,
          event_filters: block.filters.map((f) => ({
            key: f.prop,
            type: "event",
            operator: mapFilterOp(f.op as FilterOp),
            value: f.value,
          })),
        })),
      },
    },
  };
}

function cohortUrl(settings: AppSettings, id?: string) {
  const base = `${settings.posthogHost}/api/projects/${settings.posthogProjectId}/cohorts`;
  return id ? `${base}/${id}/` : `${base}/`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function listPostHogProjects(personalApiKey: string): Promise<PostHogProject[]> {
  const res = await fetch("https://app.posthog.com/api/projects/", {
    headers: { Authorization: `Bearer ${personalApiKey}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results: { id: number; name: string }[] };
  return (data.results ?? []).map(({ id, name }) => ({ id, name }));
}

export async function validateAndConnect(
  projectApiKey: string,
  personalApiKey: string,
  projectId: string,
  appToken: string
): Promise<true | string> {
  const valid = await fetch(`https://app.posthog.com/api/projects/${projectId}/`, {
    headers: { Authorization: `Bearer ${personalApiKey}` },
  });
  if (!valid.ok) return "Couldn't connect to PostHog. Check your keys and try again.";

  const posthogHost = new URL(valid.url).origin;

  const st = new StellarTools({ api_key: appToken });
  const result = await st.appInstallations
    .updateSettings({
      posthogProjectToken: projectApiKey,
      posthogPersonalApiKey: personalApiKey,
      posthogProjectId: projectId,
      posthogHost,
    })
    .catch((error) => error.message);

  return result ?? true;
}

export async function logout(appToken: string): Promise<void> {
  const st = new StellarTools({ api_key: appToken });
  const settings = await st.appInstallations.retrieveSettings();
  if (!settings?.error) {
    await st.appInstallations.updateSettings(
      Object.fromEntries(Object.keys(settings).map((key) => [key, null])) as Record<string, Primitive>,
      "suspended"
    );
  }
}

// ─── Cohorts ─────────────────────────────────────────────────────────────────

export async function saveCohort(cohort: Cohort, settings: AppSettings): Promise<Cohort> {
  const payload = compileCohort(cohort);

  let posthogCohortId: string;
  if (cohort.posthogCohortId) {
    const res = await fetch(cohortUrl(settings, cohort.posthogCohortId), {
      method: "PATCH",
      headers: { Authorization: `Bearer ${settings.posthogPersonalApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update cohort in PostHog");
    const data = (await res.json()) as { id: number };
    posthogCohortId = String(data.id);
  } else {
    const res = await fetch(cohortUrl(settings), {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.posthogPersonalApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create cohort in PostHog");
    const data = (await res.json()) as { id: number };
    posthogCohortId = String(data.id);
  }

  const saved = { ...cohort, posthogCohortId };
  await upsertCohort(saved);
  return saved;
}

export async function deleteCohort(id: string, posthogCohortId: string | null, settings: AppSettings): Promise<void> {
  if (posthogCohortId) {
    await fetch(cohortUrl(settings, posthogCohortId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${settings.posthogPersonalApiKey}` },
    }).catch(() => null);
  }
  await dbDeleteCohort(id);
}
