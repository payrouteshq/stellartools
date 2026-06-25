"use server";

import { getActivityStats as dbGetActivityStats } from "@/app/actions/db";
import { ActivityStats, EMAIL_TYPE_PREFIX, EmailOption, MailingList } from "@/app/types";
import { AppInstallationSettingValue, StellarTools } from "@stellartools/core";
import { LoopsClient } from "loops";

const LOOPS_API = "https://app.loops.so/api/v1";

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const validateApiKeyAndConnect = async (apiKey: string, appToken: string): Promise<true | string> => {
  try {
    await new LoopsClient(apiKey).testApiKey();
  } catch {
    return "Invalid API key";
  }

  const result = await new StellarTools({ api_key: appToken }).appInstallations.updateSettings({
    loopsApiKey: apiKey,
  });

  return result?.error ?? true;
};

export const logout = async (appToken: string): Promise<void> => {
  await new StellarTools({ api_key: appToken }).appInstallations.updateSettings({
    loopsApiKey: null,
  });
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const updateSettings = async (
  appToken: string,
  patch: Record<string, AppInstallationSettingValue>
): Promise<void> => {
  await new StellarTools({ api_key: appToken }).appInstallations.updateSettings(patch);
};

// ─── Emails & lists ──────────────────────────────────────────────────────────

export const listAvailableEmails = async (apiKey: string): Promise<EmailOption[]> => {
  const loops = new LoopsClient(apiKey);

  const [transactionalResult, workflowsResult] = await Promise.allSettled([
    loops.listTransactionalEmails(),
    loops.listWorkflows(),
  ]);

  const toOptions = (items: { id: string; name: string }[], prefix: string, suffix: string): EmailOption[] =>
    items.map(({ id, name }) => ({ value: `${prefix}:${id}`, label: `${name} (${suffix})` }));

  return [
    ...toOptions(settled(transactionalResult)?.data ?? [], EMAIL_TYPE_PREFIX.TRANSACTIONAL, "Transactional"),
    ...toOptions(settled(workflowsResult)?.data ?? [], EMAIL_TYPE_PREFIX.WORKFLOW, "Workflow"),
  ];
};

export const listMailingLists = async (apiKey: string): Promise<MailingList[]> => {
  return new LoopsClient(apiKey).listMailingLists();
};

// ─── Contact stats ───────────────────────────────────────────────────────────

export type ContactStats = {
  totalContacts: number | null;
  subscribed: number | null;
  mailingListCount: number;
};

export const getContactStats = async (apiKey: string): Promise<ContactStats> => {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const loopsGet = (path: string) => fetch(`${LOOPS_API}${path}`, { headers }).then((r) => r.json());

  const [totalResult, subscribedResult, listsResult] = await Promise.allSettled([
    loopsGet("/contacts?limit=1"),
    loopsGet("/contacts?subscribed=true&limit=1"),
    new LoopsClient(apiKey).listMailingLists(),
  ]);

  const totalResults = (r: typeof totalResult) => settled(r)?.pagination?.totalResults ?? null;

  return {
    totalContacts: totalResults(totalResult),
    subscribed: totalResults(subscribedResult),
    mailingListCount: settled(listsResult)?.length ?? 0,
  };
};

// ─── Activity ────────────────────────────────────────────────────────────────

export const retrieveActivityStats = async (
  orgId: string,
  periodDays: number,
  environment: string
): Promise<ActivityStats> => {
  return dbGetActivityStats(orgId, environment, periodDays);
};
