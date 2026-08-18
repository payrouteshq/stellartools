import { ApiClient } from "../api-client";
import {
  CUSTOMER_SCHEMAS,
  CreateCustomer,
  Customer,
  CustomerPortal,
  ListCustomers,
  UpdateCustomer,
} from "../schema/customer";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class CustomerApi extends BaseApiResource {
  public portal: CustomerPortalApi;

  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
    this.portal = new CustomerPortalApi(apiClient);
  }

  async create(params: CreateCustomer, options?: RequestOptions) {
    const data = this.validate<CreateCustomer>(CUSTOMER_SCHEMAS, "create", params);
    const result = await this.apiClient.post<Array<Customer>>("/customers", [data], this.getHeaders(options));
    const unwrapped = unwrap(result);
    const customer = Array.isArray(unwrapped) ? unwrapped[0] : (unwrapped as any);
    if (!customer) throw new Error("Customer create returned empty response");
    return customer as Customer;
  }

  async list(params?: ListCustomers, options?: RequestOptions) {
    const data = this.validate<ListCustomers | undefined>(CUSTOMER_SCHEMAS, "list", params);
    return unwrap(
      await this.apiClient.get<Array<Customer>>(
        `/customers?${new URLSearchParams(data as any).toString()}`,
        undefined,
        this.getHeaders(options)
      )
    );
  }

  async retrieve(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(CUSTOMER_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.get<Customer>(`/customers/${validId}`, undefined, this.getHeaders(options)));
  }

  async update(id: string, params: UpdateCustomer, options?: RequestOptions) {
    const data = this.validate<UpdateCustomer>(CUSTOMER_SCHEMAS, "update", params);
    return unwrap(await this.apiClient.put<Customer>(`/customers/${id}`, data, this.getHeaders(options)));
  }

  async delete(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(CUSTOMER_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.delete<Customer>(`/customers/${validId}`, this.getHeaders(options)));
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
