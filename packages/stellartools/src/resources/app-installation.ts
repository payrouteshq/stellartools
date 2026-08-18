import { ApiClient } from "../api-client";
import {
  APP_INSTALLATION_SCHEMAS,
  AppInstallationSettings,
  AppInstallationStatus,
} from "../schema/app-installation";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class AppInstallationApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async retrieveSettings(options?: RequestOptions): Promise<AppInstallationSettings> {
    return unwrap(await this.apiClient.get(`/app-installation`, undefined, this.getHeaders(options)));
  }

  async updateSettings(
    settings: AppInstallationSettings,
    status?: AppInstallationStatus,
    options?: RequestOptions
  ): Promise<Record<string, unknown>> {
    const validSettings = this.validate<AppInstallationSettings>(APP_INSTALLATION_SCHEMAS, "settings", settings);
    return unwrap(
      await this.apiClient.put(
        `/app-installation`,
        { settings: validSettings, ...(status ? { status } : {}) },
        this.getHeaders(options)
      )
    );
  }
}
