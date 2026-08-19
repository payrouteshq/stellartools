import { ApiClient } from "../api-client";
import { Network, RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export interface Balance {
  balance: string;
  limit: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  network: Network;
}

export class BalanceApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async retrieve(options?: RequestOptions): Promise<{ value: Balance[]; network: Network }> {
    return unwrap(
      await this.apiClient.get<{ value: Balance[]; network: Network }>("/balance", undefined, this.getHeaders(options))
    );
  }
}
