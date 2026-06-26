import { Result } from "better-result";

import { ApiClient } from "../api-client";
import { AppInstallationSettings, appInstallationSettingsSchema } from "../schema/app-installation";
import { unwrap, validateSchema } from "../utils";

export class AppInstallationApi {
  constructor(private apiClient: ApiClient) {}

  async retrieveSettings(): Promise<AppInstallationSettings | { error: string }> {
    return unwrap(await this.apiClient.get(`/app-installation`));
  }

  async updateSettings(settings: AppInstallationSettings): Promise<Record<string, any> | { error: string }> {
    return unwrap(
      await Result.andThenAsync(validateSchema(appInstallationSettingsSchema, settings), async (settings) => {
        return await this.apiClient.put(`/app-installation`, { settings });
      })
    );
  }
}
