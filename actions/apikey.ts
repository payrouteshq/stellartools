"use server";

import { retrieveCustomerPortalSession } from "@/actions/customers";
import { resolveOrgContext } from "@/actions/organization";
import { ApiKey, Network, apiKeys, db, organizations } from "@/db";
import { verifyJwt } from "@/integrations/jwt";
import { AppError } from "@/lib/error-handler";
import { generateResourceId } from "@/lib/utils";
import { AuthContext } from "@/types";
import { and, eq, sql } from "drizzle-orm";

export const postApiKey = async (
  params: Omit<ApiKey, "id" | "organizationId" | "environment" | "token">,
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .insert(apiKeys)
    .values({
      ...params,
      id: generateResourceId("st_api", organizationId, 20),
      organizationId,
      environment,
      token: generateResourceId("st_key", organizationId, 52),
    })
    .returning()
    .then(([apiKey]) => apiKey);
};

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

export const putApiKey = async (id: string, retUpdate: Partial<ApiKey>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .update(apiKeys)
    .set({ ...retUpdate, updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)))
    .returning()
    .then(([apiKey]) => apiKey);
};

export const deleteApiKey = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), eq(apiKeys.environment, environment)))
    .returning()
    .then(() => null);
};

export const resolveAuthContext = async (params: {
  apiKey?: string | null;
  sessionToken?: string | null;
  portalToken?: string | null;
  appToken?: string | null;
}): Promise<AuthContext | null> => {
  const { apiKey, sessionToken, portalToken, appToken } = params;

  // 1. Portal Degree (End-user/Customer)
  if (portalToken) {
    const session = await retrieveCustomerPortalSession(portalToken);

    if (!session) throw new AppError("Invalid portal token");

    return { organizationId: session.organizationId, environment: session.environment, type: "portal" };
  }

  // 2. Session Degree (Merchant Dashboard)
  if (sessionToken) {
    const { orgId, environment } = verifyJwt<{ orgId: string; environment: Network }>(sessionToken);
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
    const payload = verifyJwt<{ appId: string; orgId: string; instId: string; scopes: string[]; env: Network }>(
      appToken
    );

    return {
      organizationId: payload.orgId,
      environment: payload.env,
      appId: payload.appId,
      installationId: payload.instId,
      scopes: payload.scopes,
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
    .where(eq(apiKeys.token, apiKey))
    .limit(1);

  if (!row) return null;

  return { ...row, type: "apikey" };
};
