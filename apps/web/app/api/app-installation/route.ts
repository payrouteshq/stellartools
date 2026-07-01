import { retrieveAppInstallations, updateAppInstallation } from "@/actions/app";
import { apiHandler } from "@/lib/api-handler";
import { APP_INSTALLATION_STATUS, Result, z as Schema, appInstallationSettingsSchema } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["app"],
  requiredAppScope: "read:app-installation",
  handler: async ({ auth }) => {
    /**
     * Retrieves the settings for the app installation without decrypting the sensitive keys
     */
    const [response] = await retrieveAppInstallations(undefined, auth.organizationId, auth.environment, {
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
      status: Schema.enum(APP_INSTALLATION_STATUS).optional(),
    }),
  },
  handler: async ({ body, auth }) => {
    const installationId = auth.installationId;

    if (!installationId) return Result.err(new Error("Installation not found"));

    const { settings, status } = body;

    const response = await updateAppInstallation(
      installationId,
      { settings, ...(status ? { status } : {}) },
      auth.organizationId,
      auth.environment
    );

    return Result.ok(response.settings);
  },
});
