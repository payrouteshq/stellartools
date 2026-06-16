"use server";

import { getMarketplaceApp } from "@/app/dashboard/(dashboard)/marketplace/marketplace-apps";
import { App, AppInstallationStatus, Network, appInstallations, apps, db } from "@/db";
import { SQL, and, arrayContains, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import { resolveOrgContext } from "./organization";

const MARKETPLACE_INSTALL_CONFIG: Record<string, { scopes: string[]; getBaseUrl: () => string }> = {
  resend: {
    scopes: ["read:customers", "read:payments"],
    getBaseUrl: () => process.env.RESEND_APP_BASE_URL ?? "http://localhost:3001",
  },
};

export const postApp = async (params: Partial<App>) => {
  const [app] = await db
    .insert(apps)
    .values(params as App)
    .returning();

  return app;
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

export const patchInstallationSettings = async (id: string, patch: Record<string, unknown>) => {
  const [row] = await db.select().from(appInstallations).where(eq(appInstallations.id, id)).limit(1);
  if (!row) throw new Error("Installation not found");

  const [updated] = await db
    .update(appInstallations)
    .set({ settings: { ...((row.settings as Record<string, unknown>) ?? {}), ...patch } })
    .where(eq(appInstallations.id, id))
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
    version: "1.0.0" as const,
  };

  let [app] = await db.select().from(apps).where(eq(apps.slug, marketplaceId)).limit(1);

  if (!app) {
    [app] = await db
      .insert(apps)
      .values({
        id: `app_${nanoid(25)}`,
        slug: marketplaceId,
        name: marketplaceApp.name,
        baseUrl,
        appSecret: `sec_${nanoid(32)}`,
        publisher: marketplaceApp.publisher,
        featuresMarkdown: marketplaceApp.features
          .map((feature) => `## ${feature.title}\n\n${feature.description}`)
          .join("\n\n"),
        tagline: marketplaceApp.tagline,
        price: marketplaceApp.pricing,
        websiteUrl: marketplaceApp.companyWebsiteUrl,
        supportEmail: marketplaceApp.supportEmail,
        manifest,
      })
      .returning();
  } else {
    [app] = await db.update(apps).set({ baseUrl, manifest }).where(eq(apps.id, app.id)).returning();
  }

  const [existingInstallation] = await db
    .select()
    .from(appInstallations)
    .where(
      and(
        eq(appInstallations.appId, app.id),
        eq(appInstallations.organizationId, organizationId),
        eq(appInstallations.environment, environment)
      )
    )
    .limit(1);

  if (existingInstallation) {
    return { app, installation: existingInstallation, alreadyInstalled: true as const };
  }

  const [installation] = await db
    .insert(appInstallations)
    .values({
      id: `inst_${nanoid(25)}`,
      appId: app.id,
      organizationId,
      environment,
      scopes: config.scopes,
      status: "active",
      settings: {},
    })
    .returning();

  return { app, installation, alreadyInstalled: false as const };
};
