import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import {
  CreateCustomer,
  Customer,
  CustomerPortal,
  ListCustomers,
  UpdateCustomer,
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "../schema/customer";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

export class CustomerApi {
  private apiClient: ApiClient;
  public portal: CustomerPortalApi;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
    this.portal = new CustomerPortalApi(apiClient);
  }

  async create(params: CreateCustomer, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createCustomerSchema, params), async (data) => {
        const result = await this.apiClient.post<Array<Customer>>("/customers", [data], mapOptionsToHeaders(options));
        if (result.isErr()) return result;

        const customer = result.value[0];

        if (!customer) return Result.err(new Error("Customer create returned empty response"));

        return Result.ok(customer);
      })
    );
  }

  async list(params?: ListCustomers, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(listCustomersSchema.optional(), params), async (data) => {
        return await this.apiClient.get<Array<Customer>>(
          `/customers?${new URLSearchParams(data).toString()}`,
          undefined,
          mapOptionsToHeaders(options)
        );
      })
    );
  }

  async retrieve(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.get<Customer>(`/customers/${id}`, undefined, mapOptionsToHeaders(options));
      })
    );
  }

  async update(id: string, params: UpdateCustomer, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(updateCustomerSchema, params), async (data) => {
        return await this.apiClient.put<Customer>(`/customers/${id}`, data, mapOptionsToHeaders(options));
      })
    );
  }

  async delete(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.delete<Customer>(`/customers/${id}`, mapOptionsToHeaders(options));
      })
    );
  }
}

export class CustomerPortalApi {
  constructor(private apiClient: ApiClient) {}

  async create(customerId: string, options?: RequestOptions): Promise<CustomerPortal> {
    return unwrap(
      await this.apiClient.post<CustomerPortal>(
        `/customers/${customerId}/portal`,
        undefined,
        mapOptionsToHeaders(options)
      )
    );
  }
}
