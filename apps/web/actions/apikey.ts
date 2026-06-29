"use server";

import { retrieveApps } from "@/actions/app";
import { retrieveCustomerPortalSession } from "@/actions/customers";
import { resolveOrgContext } from "@/actions/organization";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { ApiKey, Network, apiKeys, db, organizations } from "@/db";
import { decrypt, encrypt } from "@/integrations/encryption";
import { AppError, safeAction } from "@/lib/action-handler";
import { generateResourceId, patchJSON } from "@/lib/utils";
import { AuthContext } from "@/types";
import { AppContext } from "@stellartools/app-sdk";
import { APP_TOKEN_PREFIX, STELLARTOOLS_ID, decodeJwt, verifyJwt } from "@stellartools/core";
import { and, eq } from "drizzle-orm";

export const postApiKey = safeAction(
  async (params: Omit<ApiKey, "id" | "organizationId" | "environment" | "token">, orgId?: string, env?: Network) => {
    const { organizationId, environment } = await resolveOrgContext(orgId, env);

    const rawToken = generateResourceId("st_key", organizationId, 52);

    const apiKey = await db
      .insert(apiKeys)
      .values({
        ...params,
        id: generateResourceId("st_api", organizationId, 20),
        organizationId,
        environment,
        token: `${SENSITIVE_KEY_PREFIX}${encrypt(rawToken)}`,
      })
      .returning()
      .then(([apiKey]) => apiKey);

    return { ...apiKey, rawToken };
  }
);

export const retrieveApiKeys = async (orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)));
};

export const retrieveApiKey = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)))
    .limit(1)
    .then(([apiKey]) => apiKey);
};

export const putApiKey = safeAction(async (id: string, retUpdate: Partial<ApiKey>, orgId?: string, env?: Network) => {
  const [{ organizationId, environment }, oldApiKey] = await Promise.all([
    resolveOrgContext(orgId, env),
    retrieveApiKey(id),
  ]);

  if (!oldApiKey) throw new AppError("API Key not found");

  const { metadata: metadataPatch, ...baseUpdate } = retUpdate;

  return await db
    .update(apiKeys)
    .set({
      ...baseUpdate,
      updatedAt: new Date(),
      ...(metadataPatch !== undefined ? { metadata: patchJSON(oldApiKey.metadata, metadataPatch) } : {}),
    })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)))
    .returning()
    .then(([apiKey]) => apiKey);
});

export const deleteApiKey = safeAction(async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)))
    .returning()
    .then(() => null);
});

export const resolveAuthContext = async (params: {
  apiKey?: string | null;
  sessionToken?: string | null;
  portalToken?: string | null;
  appToken?: string | null;
  vercelToken?: string | null;
}): Promise<AuthContext | null> => {
  const { apiKey, sessionToken, portalToken, appToken, vercelToken } = params;

  if (vercelToken) {
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && vercelToken === `Bearer ${cronSecret}`) {
      // Cron jobs usually iterate over all orgs, so we return a system-level context
      return {
        organizationId: "system",
        environment: "mainnet",
        type: "vercelToken",
      };
    }

    throw new AppError("Invalid Cron Secret");
  }

  // 1. Portal Degree (End-user/Customer)
  if (portalToken) {
    const session = await retrieveCustomerPortalSession(portalToken);

    if (!session) throw new AppError("Invalid portal token");

    return { organizationId: session.organizationId, environment: session.environment, type: "portal" };
  }

  // 2. Session Degree (Merchant Dashboard)
  if (sessionToken) {
    const { orgId, environment } = verifyJwt<{ orgId: string; environment: Network }>(
      sessionToken,
      process.env.JWT_SECRET!,
      process.env.JWT_ISSUER!,
      process.env.JWT_AUDIENCE!
    );
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!row) throw new AppError("Invalid Session");

    return { organizationId: row.id, environment, type: "session" };
  }

  // 3. App Degree (Third-party Plugin/Embedded App)
  if (appToken) {
    const rawToken = appToken.replace(APP_TOKEN_PREFIX, "");

    // Decode first (without verifying) to extract appId, then look up the app's secret and verify.
    const decoded = decodeJwt<AppContext>(rawToken);

    if (!decoded?.appId) throw new AppError("Invalid App Token");

    const [app] = await retrieveApps({ id: decoded.appId });

    if (!app) throw new AppError("Invalid App Token");

    const payload = verifyJwt<AppContext>(
      rawToken,
      decrypt(app.appSecret?.replace(SENSITIVE_KEY_PREFIX, "") ?? ""),
      STELLARTOOLS_ID
    );

    return {
      organizationId: payload.orgId,
      environment: payload.env,
      appId: app.id,
      installationId: payload.instId,
      scopes: app.scopes,
      type: "app",
    };
  }

  // 4. API Key Degree (Standard Developer Access)
  if (!apiKey?.trim()) {
    return null;
  }

  const [row] = await db
    .select({ organizationId: organizations.id, environment: apiKeys.environment, apiKeyId: apiKeys.id })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
    .where(and(eq(apiKeys.token, `${SENSITIVE_KEY_PREFIX}${encrypt(apiKey)}`), eq(apiKeys.isRevoked, false)))
    .limit(1);

  if (!row) return null;

  return { ...row, type: "apikey" };
};
