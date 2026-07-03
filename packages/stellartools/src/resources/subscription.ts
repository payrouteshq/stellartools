import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import {
  CreateSubscription,
  Subscription,
  UpdateSubscription,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from "../schema/subscription";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class SubscriptionApi {
  constructor(private apiClient: ApiClient) {}

  async create(params: CreateSubscription, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createSubscriptionSchema, params), async (data) => {
        return await this.apiClient.post<Subscription>("/subscriptions", data, mapOptionsToHeaders(options));
      })
    );
  }

  async retrieve(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.get<Subscription>(`/subscriptions/${id}`, undefined, mapOptionsToHeaders(options));
      })
    );
  }

  async list(customerId: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), customerId), async (customerId) => {
        return await this.apiClient.get<Array<Subscription>>(
          `/subscriptions?customer_id=${encodeURIComponent(customerId)}`,
          undefined,
          mapOptionsToHeaders(options)
        );
      })
    );
  }

  async pause(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.post<Subscription>(
          `/subscriptions/${id}/pause`,
          undefined,
          mapOptionsToHeaders(options)
        );
      })
    );
  }

  async resume(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.post<Subscription>(
          `/subscriptions/${id}/resume`,
          undefined,
          mapOptionsToHeaders(options)
        );
      })
    );
  }

  async update(id: string, params: UpdateSubscription, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(updateSubscriptionSchema, params), async (data) => {
        return await this.apiClient.put<Subscription>(`/subscriptions/${id}`, data, mapOptionsToHeaders(options));
      })
    );
  }

  async cancel(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.post<Subscription>(
          `/subscriptions/${id}/cancel`,
          undefined,
          mapOptionsToHeaders(options)
        );
      })
    );
  }
}
