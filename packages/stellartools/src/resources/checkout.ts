import { Result } from "better-result";

import { ApiClient } from "../api-client";
import {
  Checkout,
  CreateCheckout,
  CreateDirectCheckout,
  UpdateCheckout,
  createCheckoutSchema,
  createDirectCheckoutSchema,
  retrieveCheckoutSchema,
  updateCheckoutSchema,
} from "../schema/checkout";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class CheckoutApi {
  constructor(private apiClient: ApiClient) {}

  async create(params: CreateCheckout, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createCheckoutSchema, params), (data) =>
        this.apiClient.post<Checkout>("checkout?type=product", data, mapOptionsToHeaders(options))
      )
    );
  }

  async createDirect(params: CreateDirectCheckout, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createDirectCheckoutSchema, params), (data) =>
        this.apiClient.post<Checkout>("checkout?type=direct", data, mapOptionsToHeaders(options))
      )
    );
  }

  async retrieve(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(retrieveCheckoutSchema, { id }), async ({ id }) => {
        return await this.apiClient.get<Checkout>(`checkout/${id}`, undefined, mapOptionsToHeaders(options));
      })
    );
  }

  async update(id: string, params: UpdateCheckout, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(updateCheckoutSchema, params), async (data) => {
        return await this.apiClient.put<Checkout>(`checkout/${id}`, data, mapOptionsToHeaders(options));
      })
    );
  }

  async delete(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(retrieveCheckoutSchema, { id }), async (id) => {
        return await this.apiClient.delete<Checkout>(`checkout/${id}`, mapOptionsToHeaders(options));
      })
    );
  }
}
