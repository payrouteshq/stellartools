"use server";

import { getIndexedEmailIds } from "@/app/actions/db";
import { EmailStats } from "@/app/types";
import { Primitive, StellarTools } from "@stellartools/core";
import { Resend } from "resend";

const TERMINAL = new Set([
  "delivered",
  "opened",
  "clicked",
  "complained",
  "bounced",
  "failed",
  "suppressed",
  "canceled",
]);
const DELIVERED = new Set(["delivered", "opened", "clicked", "complained"]);
const BOUNCED = new Set(["bounced", "failed", "suppressed"]);

export const validateApiKeyAndConnect = async (
  apiKey: string,
  appToken: string,
  payload?: { fromEmail?: string }
): Promise<true | string> => {
  const resend = new Resend(apiKey);

  const { error, data } = await resend.domains.list();

  if (error) return error.message;

  const verifiedDomain = data?.data?.find((d) => d.status === "verified");

  const fromEmail = payload?.fromEmail ?? (verifiedDomain ? `noreply@${verifiedDomain.name}` : "onboarding@resend.dev");

  const st = new StellarTools({ api_key: appToken });

  const errorMessage = await st.appInstallations
    .updateSettings({ resendApiKey: apiKey, fromEmail })
    .then(() => null)
    .catch((error) => error.message);

  return errorMessage ?? true;
};

export const updateSettings = async (appToken: string, patch: Record<string, Primitive>): Promise<void> => {
  const st = new StellarTools({ api_key: appToken });

  await st.appInstallations.updateSettings(patch as Record<string, Primitive>);
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

export const listResendDomains = async (apiKey: string): Promise<string[]> => {
  const resend = new Resend(apiKey);
  const { data, error } = await resend.domains.list();
  if (error) throw new Error(error.message);
  return (data?.data ?? []).filter((d) => d.status === "verified").map((d) => d.name);
};

export const retrieveEmailTemplates = async (apiKey: string): Promise<Array<{ id: string; name: string }>> => {
  const resend = new Resend(apiKey);

  const { data, error } = await resend.templates.list();

  if (error) throw new Error(error.message);

  return data?.data?.map((t) => ({ id: t.id, name: t.name })) ?? [];
};

export const retrieveEmailStats = async (
  apiKey: string,
  orgId: string,
  periodDays: number,
  environment: string
): Promise<EmailStats> => {
  const since = new Date(Date.now() - periodDays * 864e5);
  const resend = new Resend(apiKey);

  const [indexedIds, emailList] = await Promise.all([
    getIndexedEmailIds(orgId, environment, since),
    resend.emails.list({ limit: 100 }),
  ]);

  const emails = (emailList.data?.data ?? []).filter((e) => indexedIds.has(e.id));

  const now = Date.now();
  const terminal = emails.filter((e) => TERMINAL.has(e.last_event));
  const delivered = terminal.filter((e) => DELIVERED.has(e.last_event)).length;
  const bounced = terminal.filter((e) => BOUNCED.has(e.last_event)).length;
  const t = terminal.length;

  const daily = Array.from({ length: periodDays }, (_, i) => ({ day: i + 1, sent: 0 }));
  for (const email of emails) {
    const idx = periodDays - 1 - Math.floor((now - new Date(email.created_at).getTime()) / 864e5);
    if (idx >= 0 && idx < periodDays) daily[idx].sent++;
  }

  return {
    totalSent: emails.length,
    deliveredRate: t > 0 ? `${((delivered / t) * 100).toFixed(1)}%` : "—",
    bounceRate: t > 0 ? `${((bounced / t) * 100).toFixed(1)}%` : "—",
    daily,
    emails: emails.map((e) => ({
      id: e.id,
      to: e.to[0] ?? "",
      subject: e.subject ?? "",
      status: e.last_event,
      sentAt: new Date(e.created_at).toLocaleString(),
    })),
  };
};
