"use server";

import { getMarketplaceApp } from "@/app/dashboard/(dashboard)/marketplace/marketplace-apps";
import { App, AppInstallation, AppInstallationStatus, Network, appInstallations, apps, db } from "@/db";
import { signJwt } from "@/integrations/jwt";
import { SQL, and, arrayContains, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import { resolveOrgContext } from "./organization";

const MARKETPLACE_INSTALL_CONFIG: Record<string, { scopes: string[]; version: string; getBaseUrl: () => string }> = {
  resend: {
    scopes: ["read:customers", "read:payments"],
    version: "1.0.0",
    getBaseUrl: () => process.env.RESEND_APP_BASE_URL ?? "http://localhost:3001",
  },
};

export const generateAppToken = async (installationId: string): Promise<string | null> => {
  const [row] = await db
    .select({
      id: appInstallations.id,
      appId: appInstallations.appId,
      organizationId: appInstallations.organizationId,
      environment: appInstallations.environment,
      scopes: appInstallations.scopes,
      settings: appInstallations.settings,
      appSecret: apps.appSecret,
    })
    .from(appInstallations)
    .innerJoin(apps, eq(appInstallations.appId, apps.id))
    .where(eq(appInstallations.id, installationId))
    .limit(1);

  if (!row) return null;

  return signJwt(
    {
      appId: row.appId,
      orgId: row.organizationId,
      instId: row.id,
      scopes: row.scopes,
      env: row.environment,
      settings: row.settings ?? {},
    },
    "1h",
    row.appSecret,
    row.appId
  );
};

export const postApp = async (params: Partial<App>) => {
  const [app] = await db
    .insert(apps)
    .values(params as App)
    .returning();

  return app;
};

export const postAppInstallation = async (params: Partial<AppInstallation>) => {
  const installationId = params.id ?? `inst_${nanoid(25)}`;
  const [installation] = await db
    .insert(appInstallations)
    .values({ ...params, id: installationId } as AppInstallation)
    .onConflictDoUpdate({
      target: [appInstallations.appId, appInstallations.organizationId, appInstallations.environment],
      set: { updatedAt: new Date() },
    })
    .returning();

  return { installation, alreadyInstalled: installation.id !== installationId };
};

export const retrieveInstalledApps = async (
  params?: { scopes?: string[]; status?: AppInstallationStatus },
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let whereClause: SQL[] = [
    eq(appInstallations.organizationId, organizationId),
    eq(appInstallations.environment, environment),
  ];

  if (params?.status) {
    whereClause.push(eq(appInstallations.status, params.status));
  }
  if (params?.scopes && params.scopes.length > 0) {
    whereClause.push(
      or(arrayContains(appInstallations.scopes, params.scopes), arrayContains(appInstallations.scopes, ["*"]))!
    );
  }

  return await db
    .select()
    .from(apps)
    .innerJoin(appInstallations, eq(apps.id, appInstallations.appId))
    .where(and(...whereClause));
};

export const updateAppInstallation = async (
  id: string,
  patch: Record<string, unknown>,
  orgId?: string,
  env?: Network,
) => {
  const { organizationId } = await resolveOrgContext(orgId, env);

  const [row] = await db
    .select()
    .from(appInstallations)
    .where(and(eq(appInstallations.id, id), eq(appInstallations.organizationId, organizationId)))
    .limit(1);

  if (!row) throw new Error("Installation not found");

  const [updated] = await db
    .update(appInstallations)
    .set({ settings: { ...((row.settings as Record<string, unknown>) ?? {}), ...patch } })
    .where(and(eq(appInstallations.id, id), eq(appInstallations.organizationId, organizationId)))
    .returning();

  return updated.settings as Record<string, unknown>;
};

export const installMarketplaceApp = async (marketplaceId: string) => {
  const marketplaceApp = getMarketplaceApp(marketplaceId);
  const config = MARKETPLACE_INSTALL_CONFIG[marketplaceId];

  if (!marketplaceApp || marketplaceApp.status !== "available" || !config) {
    throw new Error("This app is not available to install yet.");
  }

  const { organizationId, environment } = await resolveOrgContext();
  const baseUrl = config.getBaseUrl();
  const manifest = {
    name: marketplaceApp.name,
    description: marketplaceApp.tagline,
    iconUrl: marketplaceApp.iconUrl,
    homepageUrl: marketplaceApp.companyWebsiteUrl,
    baseUrl,
    scopes: config.scopes,
    version: config.version,
  };

  const [app] = await db
    .insert(apps)
    .values({
      id: `app_${nanoid(25)}`,
      slug: marketplaceId,
      name: marketplaceApp.name,
      baseUrl,
      appSecret: `sec_${nanoid(32)}`,
      publisher: marketplaceApp.publisher,
      featuresMarkdown: marketplaceApp.features
        .map((f) => `## ${f.title}\n\n${f.description}`)
        .join("\n\n"),
      tagline: marketplaceApp.tagline,
      price: marketplaceApp.pricing,
      websiteUrl: marketplaceApp.companyWebsiteUrl,
      supportEmail: marketplaceApp.supportEmail,
      manifest,
    })
    .onConflictDoUpdate({
      target: apps.slug,
      set: { baseUrl, manifest, name: marketplaceApp.name },
    })
    .returning();

  const { installation, alreadyInstalled } = await postAppInstallation({
    appId: app.id,
    organizationId,
    environment,
    scopes: config.scopes,
    status: "active",
    settings: {},
  });

  return { app, installation, alreadyInstalled };
};
