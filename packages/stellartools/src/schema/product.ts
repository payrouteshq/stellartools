import { z } from "zod";

import { schemaFor } from "../utils";
import { Environment, environmentSchema } from "./shared";

export const productTypeEnum = z.enum(["one_time", "subscription", "metered"]);

export type ProductType = z.infer<typeof productTypeEnum>;

export const productStatusEnum = z.enum(["active", "archived"]);

export type ProductStatus = z.infer<typeof productStatusEnum>;

export const recurringPeriodEnum = z.enum(["day", "week", "month", "year"]);

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
   * The asset ID of the product.
   */
  asset_code: string;

  /**
   * The billing type of the product.
   */
  type: ProductType;

  /**
   * The price amount of the product in its asset (e.g. `10` for 10 XLM).
   */
  price_amount: number;

  /**
   * The billing interval for subscription products.
   */
  recurring_period?: RecurringPeriod;

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
    asset_code: z.string(),
    type: productTypeEnum,
    price_amount: z.number(),
    recurring_period: recurringPeriodEnum.optional(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    environment: environmentSchema,
    unit: z.string().optional(),
    units_per_credit: z.number().optional(),
    total_credits: z.number().optional(),
  })
);

export const createProductSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  images: z.array(z.string()).optional().default([]),
  type: productTypeEnum,
  asset_code: z.string(),
  price_amount: z.number(),
  recurring_period: recurringPeriodEnum.optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  unit: z.string().optional(),
  units_per_credit: z.number().optional(),
  total_credits: z.number().optional(),
});

export type CreateProduct = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  unit: z.string().nullable().optional(),
  units_per_credit: z.number().optional(),
  price_amount: z.number().optional(),
  recurring_period: recurringPeriodEnum.optional(),
  total_credits: z.number().nullable().optional(),
});

export type UpdateProduct = z.infer<typeof updateProductSchema>;
