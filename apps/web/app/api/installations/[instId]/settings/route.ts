import { updateAppInstallation } from "@/actions/app";
import { appInstallations, db } from "@/db";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";
import { eq } from "drizzle-orm";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["app"],
  schema: { params: Schema.object({ instId: Schema.string() }) },
  handler: async ({ params, auth }) => {
    if (auth.installationId !== params.instId) return Result.err(new Error("Forbidden"));

    const [row] = await db
      .select({ settings: appInstallations.settings })
      .from(appInstallations)
      .where(eq(appInstallations.id, params.instId))
      .limit(1);

    if (!row) return Result.err(new Error("Installation not found"));
    return Result.ok(row.settings ?? {});
  },
});

export const PATCH = apiHandler({
  auth: ["app"],
  schema: {
    params: Schema.object({ instId: Schema.string() }),
    body: Schema.record(Schema.string(), Schema.unknown()),
  },
  handler: async ({ params, body, auth }) => {
    if (auth.installationId !== params.instId) return Result.err(new Error("Forbidden"));
    const settings = await updateAppInstallation(params.instId, body, auth.organizationId, auth.environment);
    return Result.ok(settings);
  },
});
