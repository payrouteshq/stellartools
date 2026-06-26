import { retrieveInstalledApps, updateAppInstallation } from "@/actions/app";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema, appInstallationSettingsSchema } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["app"],
  requiredAppScope: "read:app-installation",
  handler: async ({ auth }) => {
    /**
     * Retrieves the settings for the app installation without decrypting the sensitive keys
     */
    const [response] = await retrieveInstalledApps(undefined, auth.organizationId, auth.environment, {
      installationId: auth.installationId,
    });

    return Result.ok(response?.app_installation?.settings);
  },
});

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

    const response = await updateAppInstallation(installationId, body, auth.organizationId, auth.environment);

    return Result.ok(response.settings);
  },
});
