"use server";

import { resolveOrgContext } from "@/actions/organization";
import { APP_SENSITIVE_KEY_PREFIX } from "@/constant";
import { App, AppInstallation, AppInstallationStatus, AppStatus, Network, appInstallations, apps, db } from "@/db";
import { decrypt, encrypt } from "@/integrations/encryption";
import { maskData, unmaskData } from "@/lib/utils";
import { AppContext } from "@stellartools/app-sdk";
import { AppScope } from "@stellartools/app-sdk/schema";
import { APP_TOKEN_PREFIX, STELLARTOOLS_ID, signJwt } from "@stellartools/core";
import { SQL, and, arrayContains, eq, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export const generateAppToken = async (
  installationId: string,
  uiContext: { periodDays: number; currency: string; theme: "light" | "dark" },
  orgId?: string,
  env?: Network
): Promise<string | null> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  if (!organizationId || !environment) return null;

  const [row] = await db
    .select({
      id: appInstallations.id,
      appId: appInstallations.appId,
      orgId: appInstallations.organizationId,
      env: appInstallations.environment,
      scopes: appInstallations.scopes,
      settings: appInstallations.settings,
      appSecret: apps.appSecret,
    })
    .from(appInstallations)
    .innerJoin(apps, eq(appInstallations.appId, apps.id))
    .where(
      and(
        eq(appInstallations.id, installationId),
        eq(appInstallations.organizationId, organizationId),
        eq(appInstallations.environment, environment)
      )
    )
    .limit(1);

  if (!row) return null;

  const context: AppContext = {
    orgId: row.orgId,
    env: row.env,
    instId: row.id,
    appId: row.appId,
    scopes: row.scopes,
    settings: unmaskData(row.settings ?? {}, APP_SENSITIVE_KEY_PREFIX, decrypt),
    ui: {
      periodDays: uiContext.periodDays,
      currency: uiContext.currency,
      theme: uiContext.theme,
    },
  };

  const rawToken = signJwt(context, "1h", decrypt(row.appSecret), STELLARTOOLS_ID);
  const token = `${APP_TOKEN_PREFIX}${rawToken}`;

  return token;
};

export const postApp = async (params: Omit<App, "id" | "createdAt">) => {
  const encryptedSecret = encrypt(params.appSecret);

  return await db
    .insert(apps)
    .values({ ...params, appSecret: encryptedSecret } as App)
    .returning()
    .then(([app]) => app);
};

export const retrieveApps = async (filters?: { id?: string; slug?: string; status?: AppStatus }) => {
  let whereClause: SQL[] = [];

  if (filters?.id) {
    whereClause.push(eq(apps.id, filters.id));
  } else if (filters?.slug) {
    whereClause.push(eq(apps.slug, filters.slug));
  } else if (filters?.status) {
    whereClause.push(eq(apps.status, filters.status));
  }

  return await db
    .select()
    .from(apps)
    .where(and(...whereClause))
    .orderBy(sql`${apps.status} = 'available' desc`);
};

export const postAppInstallation = async (params: Partial<AppInstallation>) => {
  const installationId = params.id ?? `inst_${nanoid(25)}`;
  const [installation] = await db
    .insert(appInstallations)
    .values({ ...params, id: installationId } as AppInstallation)
    .onConflictDoUpdate({
      target: [appInstallations.appId, appInstallations.organizationId, appInstallations.environment],
      set: { updatedAt: new Date(), status: "active" },
    })
    .returning();

  return { installation, alreadyInstalled: installation.id !== installationId };
};

export const retrieveInstalledApps = async (
  params?: { scopes?: AppScope[]; status?: AppInstallationStatus },
  orgId?: string,
  env?: Network,
  filters?: { installationId?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let whereClause: SQL[] = [
    eq(appInstallations.organizationId, organizationId),
    eq(appInstallations.environment, environment),
  ];

  whereClause.push(eq(appInstallations.status, params?.status ?? "active"));

  if (params?.scopes && params.scopes.length > 0) {
    whereClause.push(
      or(arrayContains(appInstallations.scopes, params.scopes), arrayContains(appInstallations.scopes, ["*"]))!
    );
  }

  if (filters?.installationId) {
    whereClause.push(eq(appInstallations.id, filters.installationId));
  }

  return await db
    .select()
    .from(apps)
    .innerJoin(appInstallations, eq(apps.id, appInstallations.appId))
    .where(and(...whereClause));
};

export const updateAppInstallation = async (
  id: string,
  patch: Partial<AppInstallation>,
  orgId?: string,
  env?: Network
) => {
  const { organizationId } = await resolveOrgContext(orgId, env);

  const [row] = await db
    .select({ installation: appInstallations, sensitiveKeys: apps.sensitiveKeys })
    .from(appInstallations)
    .innerJoin(apps, eq(appInstallations.appId, apps.id))
    .where(and(eq(appInstallations.id, id), eq(appInstallations.organizationId, organizationId)))
    .limit(1);

  if (!row) throw new Error("Installation not found");

  const { settings: settingsPatch, ...baseUpdate } = patch;

  const sensitiveKeys = row.sensitiveKeys ?? [];

  const maskedPatch = settingsPatch
    ? maskData(settingsPatch as Record<string, any>, sensitiveKeys, APP_SENSITIVE_KEY_PREFIX, encrypt)
    : undefined;

  const [updated] = await db
    .update(appInstallations)
    .set({
      ...baseUpdate,
      updatedAt: new Date(),
      settings: { ...row.installation.settings, ...maskedPatch },
      ...(baseUpdate.status ? { status: baseUpdate.status } : {}),
    })
    .where(and(eq(appInstallations.id, id), eq(appInstallations.organizationId, organizationId)))
    .returning();

  return updated;
};

export const deleteAppInstallation = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId } = await resolveOrgContext(orgId, env);
  await db
    .delete(appInstallations)
    .where(and(eq(appInstallations.id, id), eq(appInstallations.organizationId, organizationId)));
};

export const installMarketplaceApp = async (appSlug: string) => {
  const [app] = await retrieveApps({ slug: appSlug });

  const { organizationId, environment } = await resolveOrgContext();

  if (!app) throw new Error("App not found");

  const scopes = app.scopes;

  const { installation, alreadyInstalled } = await postAppInstallation({
    appId: app.id,
    organizationId,
    environment,
    scopes,
    status: "active",
    settings: {},
  });

  return { app, installation, alreadyInstalled };
};
