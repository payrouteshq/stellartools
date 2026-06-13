"use server";

import { App, AppInstallationStatus, Network, appInstallations, apps, db } from "@/db";
import { type AppScope } from "@stellartools/app-embed-bridge";
import { SQL, and, arrayContains, eq, or } from "drizzle-orm";

import { resolveOrgContext } from "./organization";

export const postApp = async (params: Partial<App>) => {
  const [app] = await db
    .insert(apps)
    .values(params as App)
    .returning();

  return app;
};

export const retrieveInstalledApps = async (
  params?: { scopes?: Array<AppScope>; status?: AppInstallationStatus },
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
