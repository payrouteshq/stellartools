import { ApiClient } from "../api-client";
import { CreateRefund, REFUND_SCHEMAS, Refund } from "../schema/refund";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class RefundApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async create(params: CreateRefund, options?: RequestOptions) {
    const data = this.validate<CreateRefund>(REFUND_SCHEMAS, "create", params);
    return unwrap(await this.apiClient.post<Refund>("/refunds", data, this.getHeaders(options)));
  }
}
