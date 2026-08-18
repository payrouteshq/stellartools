import { ApiClient } from "../api-client";
import {
  CreateSubscription,
  SUBSCRIPTION_SCHEMAS,
  Subscription,
  UpdateSubscription,
} from "../schema/subscription";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class SubscriptionApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async create(params: CreateSubscription, options?: RequestOptions) {
    const data = this.validate<CreateSubscription>(SUBSCRIPTION_SCHEMAS, "create", params);
    return unwrap(await this.apiClient.post<Subscription>("/subscriptions", data, this.getHeaders(options)));
  }

  async retrieve(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(SUBSCRIPTION_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.get<Subscription>(`/subscriptions/${validId}`, undefined, this.getHeaders(options)));
  }

  async list(customerId: string, options?: RequestOptions) {
    const { customerId: validId } = this.validate<{ customerId: string }>(SUBSCRIPTION_SCHEMAS, "list", { customerId });
    return unwrap(
      await this.apiClient.get<Array<Subscription>>(
        `/subscriptions?customer_id=${encodeURIComponent(validId)}`,
        undefined,
        this.getHeaders(options)
      )
    );
  }

  async pause(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(SUBSCRIPTION_SCHEMAS, "pause", { id });
    return unwrap(await this.apiClient.post<Subscription>(`/subscriptions/${validId}/pause`, undefined, this.getHeaders(options)));
  }

  async resume(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(SUBSCRIPTION_SCHEMAS, "resume", { id });
    return unwrap(await this.apiClient.post<Subscription>(`/subscriptions/${validId}/resume`, undefined, this.getHeaders(options)));
  }

  async update(id: string, params: UpdateSubscription, options?: RequestOptions) {
    const data = this.validate<UpdateSubscription>(SUBSCRIPTION_SCHEMAS, "update", params);
    return unwrap(await this.apiClient.put<Subscription>(`/subscriptions/${id}`, data, this.getHeaders(options)));
  }

  async cancel(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(SUBSCRIPTION_SCHEMAS, "cancel", { id });
    return unwrap(await this.apiClient.post<{ success: boolean }>(`/subscriptions/${validId}/cancel`, undefined, this.getHeaders(options)));
  }
}
