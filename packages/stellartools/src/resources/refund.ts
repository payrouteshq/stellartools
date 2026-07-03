import { Result } from "better-result";

import { ApiClient } from "../api-client";
import { CreateRefund, Refund, createRefundSchema } from "../schema/refund";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class RefundApi {
  constructor(private apiClient: ApiClient) {}

  async create(params: CreateRefund, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createRefundSchema, params), async (data) => {
        return await this.apiClient.post<Refund>("/refunds", data, mapOptionsToHeaders(options));
      })
    );
  }
}
