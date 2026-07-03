import { ApiClient } from "../api-client";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap } from "../utils";

export interface Balance {
  balance: string;
  limit: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

export class BalanceApi {
  constructor(private readonly apiClient: ApiClient) {}

  async retrieve(options?: RequestOptions): Promise<Balance[] | { error: string }> {
    return unwrap(await this.apiClient.get<Balance[]>("/balance", undefined, mapOptionsToHeaders(options)));
  }
}
