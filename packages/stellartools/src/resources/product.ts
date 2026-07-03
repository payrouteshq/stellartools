import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import { CreateProduct, Product, createProductSchema } from "../schema/product";
import { unwrap, validateSchema } from "../utils";

export class ProductApi {
  constructor(private readonly apiClient: ApiClient) {}

  async create(params: CreateProduct) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createProductSchema, params), (data) =>
        this.apiClient.post<Product>("/product", data)
      )
    );
  }

  async list(params?: { limit?: number; starting_after?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.starting_after) query.set("starting_after", params.starting_after);
    return unwrap(await this.apiClient.get<Product[]>(`/products?${query}`));
  }

  async retrieve(productId: string) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), productId), async (productId) => {
        return await this.apiClient.get<Product>(`/products/${productId}`);
      })
    );
  }
}
