import { ApiClient } from "../api-client";
import { CreateProduct, PRODUCT_SCHEMAS, Product, UpdateProduct } from "../schema/product";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class ProductApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async create(params: CreateProduct, options?: RequestOptions) {
    const data = this.validate<CreateProduct>(PRODUCT_SCHEMAS, "create", params);
    return unwrap(await this.apiClient.post<Product>("/product", data, this.getHeaders(options)));
  }

  async list(params?: { limit?: number; starting_after?: string }, options?: RequestOptions) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.starting_after) query.set("starting_after", params.starting_after);
    return unwrap(await this.apiClient.get<Product[]>(`/products?${query}`, undefined, this.getHeaders(options)));
  }

  async retrieve(productId: string, options?: RequestOptions) {
    const { productId: validId } = this.validate<{ productId: string }>(PRODUCT_SCHEMAS, "retrieve", { productId });
    return unwrap(await this.apiClient.get<Product>(`/products/${validId}`, undefined, this.getHeaders(options)));
  }

  async update(id: string, params: UpdateProduct, options?: RequestOptions) {
    const data = this.validate<UpdateProduct>(PRODUCT_SCHEMAS, "update", params);
    return unwrap(await this.apiClient.put<Product>(`/products/${id}`, data, this.getHeaders(options)));
  }
}
