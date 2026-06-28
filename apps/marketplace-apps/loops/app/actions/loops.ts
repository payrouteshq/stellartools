"use server";

import { getActivityStats as dbGetActivityStats } from "@/app/actions/db";
import { ActivityStats, EmailOption, MailingList } from "@/app/types";
import { Primitive, StellarTools } from "@stellartools/core";
import { LoopsClient } from "loops";

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
  const st = new StellarTools({ api_key: appToken });

  const settings = await st.appInstallations.retrieveSettings();

  if (!settings?.error) {
    await st.appInstallations.updateSettings(
      Object.fromEntries(Object.keys(settings).map((key) => [key, null])),
      "suspended"
    );
  }
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const updateSettings = async (appToken: string, patch: Record<string, Primitive>): Promise<void> => {
  await new StellarTools({ api_key: appToken }).appInstallations.updateSettings(patch);
};

// ─── Emails & lists ──────────────────────────────────────────────────────────

export const listAvailableEmails = async (apiKey: string): Promise<EmailOption[]> => {
  const result = await new LoopsClient(apiKey).listTransactionalEmails().catch(() => null);
  return (result?.data ?? []).map(({ id, name }) => ({ value: id, label: name }));
};

export const listMailingLists = async (apiKey: string): Promise<MailingList[]> => {
  return new LoopsClient(apiKey).listMailingLists();
};

// ─── Activity ────────────────────────────────────────────────────────────────

export const retrieveActivityStats = async (
  orgId: string,
  periodDays: number,
  environment: string
): Promise<ActivityStats> => {
  return dbGetActivityStats(orgId, environment, periodDays);
};
