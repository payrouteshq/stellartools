import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import { CreateProduct, Product, createProductSchema } from "../schema/product";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class ProductApi {
  constructor(private readonly apiClient: ApiClient) {}

  async create(params: CreateProduct, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createProductSchema, params), (data) =>
        this.apiClient.post<Product>("/product", data, mapOptionsToHeaders(options))
      )
    );
  }

  async list(params?: { limit?: number; starting_after?: string }, options?: RequestOptions) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.starting_after) query.set("starting_after", params.starting_after);
    return unwrap(
      await this.apiClient.get<Product[]>(`/products?${query}`, undefined, mapOptionsToHeaders(options))
    );
  }

  async retrieve(productId: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), productId), async (productId) => {
        return await this.apiClient.get<Product>(`/products/${productId}`, undefined, mapOptionsToHeaders(options));
      })
    );
  }
}
