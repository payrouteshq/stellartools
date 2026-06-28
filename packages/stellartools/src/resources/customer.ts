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
import { unwrap, validateSchema } from "../utils";

export class CustomerApi {
  private apiClient: ApiClient;
  public portal: CustomerPortalApi;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
    this.portal = new CustomerPortalApi(apiClient);
  }

  async create(params: CreateCustomer) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createCustomerSchema, params), async (data) => {
        return await this.apiClient.post<Customer>("/customers", [data]);
      })
    );
  }

  async list(params?: ListCustomers) {
    return unwrap(
      await Result.andThenAsync(validateSchema(listCustomersSchema.optional(), params), async (data) => {
        return await this.apiClient.get<Array<Customer>>(`/customers?${new URLSearchParams(data).toString()}`);
      })
    );
  }

  async retrieve(id: string) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.get<Customer>(`/customers/${id}`);
      })
    );
  }

  async update(id: string, params: UpdateCustomer) {
    return unwrap(
      await Result.andThenAsync(validateSchema(updateCustomerSchema, params), async (data) => {
        return await this.apiClient.put<Customer>(`/customers/${id}`, data);
      })
    );
  }

  async delete(id: string) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.delete<Customer>(`/customers/${id}`);
      })
    );
  }
}

export class CustomerPortalApi {
  constructor(private apiClient: ApiClient) {}

  async create(customerId: string): Promise<CustomerPortal> {
    return unwrap(await this.apiClient.post<CustomerPortal>(`/customers/${customerId}/portal`));
  }
}
