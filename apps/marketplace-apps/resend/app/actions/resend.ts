"use server";

import { AppInstallationSettingValue, StellarTools } from "@stellartools/core";
import { Resend } from "resend";

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

  const result = await st.appInstallations.updateSettings({ resendApiKey: apiKey, fromEmail });

  if (result?.error) return result.error;

  return true;
};

export const updateSettings = async (
  appToken: string,
  patch: Record<string, AppInstallationSettingValue>
): Promise<void> => {
  const st = new StellarTools({ api_key: appToken });

  await st.appInstallations.updateSettings(patch as Record<string, AppInstallationSettingValue>);
};

export const retrieveEmailTemplates = async (apiKey: string): Promise<Array<{ id: string; name: string }>> => {
  const resend = new Resend(apiKey);

  const { data, error } = await resend.templates.list();

  if (error) throw new Error(error.message);

  return data?.data?.map((t) => ({ id: t.id, name: t.name })) ?? [];
};
