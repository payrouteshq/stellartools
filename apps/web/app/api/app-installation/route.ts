import { updateAppInstallation } from "@/actions/app";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema, appInstallationSettingsSchema } from "@stellartools/core";

export const PUT = apiHandler({
  auth: ["app"],
  requiredAppScope: "write:app-installation",
  schema: {
    body: Schema.object({
      settings: appInstallationSettingsSchema,
    }),
  },
  handler: async ({ body, auth }) => {
    const installationId = auth.installationId;

    if (!installationId) return Result.err(new Error("Installation not found"));

    const response = await updateAppInstallation(installationId, body.settings, auth.organizationId, auth.environment);

    return Result.ok(response.settings);
  },
});
