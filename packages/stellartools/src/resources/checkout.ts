import { ApiClient } from "../api-client";
import {
  CHECKOUT_SCHEMAS,
  Checkout,
  CreateCheckout,
  CreateDirectCheckout,
  UpdateCheckout,
} from "../schema/checkout";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class CheckoutApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async create(params: CreateCheckout, options?: RequestOptions) {
    const data = this.validate<CreateCheckout>(CHECKOUT_SCHEMAS, "create", params);
    return unwrap(await this.apiClient.post<Checkout>("checkout?type=product", data, this.getHeaders(options)));
  }

  async createDirect(params: CreateDirectCheckout, options?: RequestOptions) {
    const data = this.validate<CreateDirectCheckout>(CHECKOUT_SCHEMAS, "createDirect", params);
    return unwrap(await this.apiClient.post<Checkout>("checkout?type=direct", data, this.getHeaders(options)));
  }

  async retrieve(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(CHECKOUT_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.get<Checkout>(`checkout/${validId}`, undefined, this.getHeaders(options)));
  }

  async update(id: string, params: UpdateCheckout, options?: RequestOptions) {
    const data = this.validate<UpdateCheckout>(CHECKOUT_SCHEMAS, "update", params);
    return unwrap(await this.apiClient.put<Checkout>(`checkout/${id}`, data, this.getHeaders(options)));
  }

  async delete(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(CHECKOUT_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.delete<Checkout>(`checkout/${validId}`, this.getHeaders(options)));
  }
}
