import { z } from "zod";

import { schemaFor } from "../utils";
import { ApiVersion } from "../versioning";
import { currencyCodeSchema } from "./checkout";
import { Environment, environmentSchema } from "./shared";

export const productTypeEnum = z.enum(["one_time", "subscription"]);

export type ProductType = z.infer<typeof productTypeEnum>;

export const productStatusEnum = z.enum(["active", "archived"]);

export type ProductStatus = z.infer<typeof productStatusEnum>;

export const recurringPeriodEnum = z.enum(["day", "week", "month", "year", "custom"]);

export type RecurringPeriod = z.infer<typeof recurringPeriodEnum>;

export interface Product {
  /**
   * The unique identifier for the product.
   */
  id: string;

  /**
   * The name of the product.
   */
  name: string;

  /**
   * The description of the product.
   */
  description?: string;

  /**
   * The images of the product.
   */
  images: string[];

  /**
   * The status of the product.
   */
  status: ProductStatus;

  /**
   * The billing type of the product.
   */
  type: ProductType;

  /**
   * The price amount of the product in its asset (e.g. `10` for 10 XLM).
   */
  price_amount_cents: number;

  /**
   * The billing interval for subscription products.
   */
  recurring_period?: RecurringPeriod;

  /**
   * Duration in milliseconds for custom billing intervals.
   * Only present when recurring_period is "custom".
   */
  custom_duration_ms?: number;

  /**
   * The created at timestamp for the product.
   */
  created_at: string;

  /**
   * The updated at timestamp for the product.
   */
  updated_at: string;

  /**
   * The metadata of the product.
   */
  metadata: Record<string, unknown>;

  /**
   * The environment of the product.
   */
  environment: Environment;

  /**
   * The unit of the product.
   */
  unit?: string;

  /**
   * The units per credit of the product.
   */
  units_per_credit?: number;

  /**
   * The total credits of the product.
   */
  total_credits?: number;
}

export const productSchema = schemaFor<Product>()(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    images: z.array(z.string()),
    status: productStatusEnum,
    type: productTypeEnum,
    price_amount_cents: z.number(),
    recurring_period: recurringPeriodEnum.optional(),
    custom_duration_ms: z.number().int().positive().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    environment: environmentSchema,
    unit: z.string().optional(),
    units_per_credit: z.number().optional(),
    total_credits: z.number().optional(),
  })
);

export const CreateProductSchema_2026_08_18 = z.object({
  name: z.string(),
  description: z.string().optional(),
  images: z.array(z.string()).optional().default([]),
  type: productTypeEnum,
  price_amount_cents: z.number(),
  recurring_period: recurringPeriodEnum.optional(),
  custom_duration_ms: z.number().int().min(3600000, "Minimum duration is 1 hour").optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  unit: z.string().optional(),
  units_per_credit: z.number().optional(),
  total_credits: z.number().optional(),
  credits_expiry_days: z.number().int().min(1).nullable().optional(),
  currency_code: currencyCodeSchema,
});

export type CreateProduct = z.infer<typeof CreateProductSchema_2026_08_18>;

export const UpdateProductSchema_2026_08_18 = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateProduct = z.infer<typeof UpdateProductSchema_2026_08_18>;

export const RetrieveProductSchema_2026_08_18 = z.object({ productId: z.string() });

export const PRODUCT_SCHEMAS = {
  "2026-08-18": {
    create: CreateProductSchema_2026_08_18,
    update: UpdateProductSchema_2026_08_18,
    retrieve: RetrieveProductSchema_2026_08_18,
  },
} satisfies Record<ApiVersion, { create: z.ZodSchema; update: z.ZodSchema; retrieve: z.ZodSchema }>;
