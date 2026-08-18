import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import { Payment } from "../schema/payment";
import { RequestOptions } from "../types";
import { unwrap, validateSchema } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class PaymentApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async list(params?: { limit?: number; customer?: string; starting_after?: string }, options?: RequestOptions) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.customer) query.set("customer", params.customer);
    if (params?.starting_after) query.set("starting_after", params.starting_after);
    return unwrap(await this.apiClient.get<Payment[]>(`/payment?${query}`, undefined, this.getHeaders(options)));
  }

  async retrieve(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async () => {
        return await this.apiClient.get<Payment>(`/payment/${id}`, undefined, this.getHeaders(options));
      })
    );
  }
}
