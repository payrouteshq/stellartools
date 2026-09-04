import { z } from "zod";

import { schemaFor } from "../utils";
import { ApiVersion } from "../versioning";

export interface CustomerWallet {
  /**
   * The unique identifier for the wallet.
   */
  id: string;

  /**
   * The address of the wallet.
   */
  address: string;

  /**
   * The metadata of the wallet.
   */
  metadata?: Record<string, unknown>;

  /**
   * The created at timestamp for the wallet.
   */
  created_at: string;
}

export interface Customer {
  /**
   * The unique identifier for the customer.
   */
  id: string;

  /**
   * The email address of the customer.
   */
  email: string;

  /**
   * The name of the customer.
   */
  name: string;

  /**
   * The wallets of the customer.
   */
  wallets: CustomerWallet[];

  /**
   * The phone number of the customer.
   */
  phone?: string;

  /**
   * URL to the customer image
   */
  image?: string | null;

  /**
   * The application metadata for the customer.
   */
  metadata?: Record<string, string> | null;

  /**
   * The created at timestamp for the customer.
   */
  created_at: string;

  /**
   * The updated at timestamp for the customer.
   */
  updated_at: string;
}

export const customerWalletSchema = schemaFor<CustomerWallet>()(
  z.object({
    id: z.string(),
    address: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    created_at: z.string(),
  })
);

export const customerSchema = schemaFor<Customer>()(
  z.object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    phone: z.string().optional(),
    image: z.url().nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    wallets: z.array(customerWalletSchema),
  })
);

export const CreateCustomerSchema_2026_08_18 = z.object({
  email: z.email(),
  name: z.string(),
  phone: z.string().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  image: z.url().nullable().optional(),
});

export interface CreateCustomer extends z.infer<typeof CreateCustomerSchema_2026_08_18> {}

export const UpdateCustomerSchema_2026_08_18 = z.object({
  email: z.email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  image: z.url().nullable().optional(),
});

export interface UpdateCustomer extends z.infer<typeof UpdateCustomerSchema_2026_08_18> {}

export interface ListCustomers extends Partial<Pick<Customer, "email" | "phone">> {}

export const ListCustomersSchema_2026_08_18 = schemaFor<ListCustomers>()(
  z.union([z.object({ email: z.email() }), z.object({ phone: z.string() })])
);

export interface CustomerPortal {
  /**
   * The URL of the portal session.
   */
  url: string;

  /**
   * The date and time the portal session expires.
   */
  expires_at: string;
}

export const RetrieveCustomerSchema_2026_08_18 = z.object({ id: z.string() });

export const CUSTOMER_SCHEMAS = {
  "2026-08-18": {
    create: CreateCustomerSchema_2026_08_18,
    update: UpdateCustomerSchema_2026_08_18,
    list: ListCustomersSchema_2026_08_18,
    retrieve: RetrieveCustomerSchema_2026_08_18,
  },
} satisfies Partial<
  Record<ApiVersion, { create: z.ZodSchema; update: z.ZodSchema; list: z.ZodSchema; retrieve: z.ZodSchema }>
>;
