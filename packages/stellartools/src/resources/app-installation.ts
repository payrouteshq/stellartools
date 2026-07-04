import { Result } from "better-result";

import { ApiClient } from "../api-client";
import {
  AppInstallationSettings,
  AppInstallationStatus,
  appInstallationSettingsSchema,
} from "../schema/app-installation";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class AppInstallationApi {
  constructor(private apiClient: ApiClient) {}

  async retrieveSettings(options?: RequestOptions): Promise<AppInstallationSettings> {
    return unwrap(await this.apiClient.get(`/app-installation`, undefined, mapOptionsToHeaders(options)));
  }

  async updateSettings(
    settings: AppInstallationSettings,
    status?: AppInstallationStatus,
    options?: RequestOptions
  ): Promise<Record<string, unknown>> {
    return unwrap(
      await Result.andThenAsync(validateSchema(appInstallationSettingsSchema, settings), async (settings) => {
        return await this.apiClient.put(
          `/app-installation`,
          { settings, ...(status ? { status } : {}) },
          mapOptionsToHeaders(options)
        );
      })
    );
  }
}
