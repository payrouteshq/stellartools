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
   * The organization ID of the product.
   */
  organizationId: string;

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
  assetId: string;

  /**
   * The billing type of the product.
   */
  type: ProductType;

  /**
   * The created at timestamp for the product.
   */
  createdAt: string;

  /**
   * The updated at timestamp for the product.
   */
  updatedAt: string;

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
   * The unit divisor of the product.
   */
  unitDivisor?: number | null;

  /**
   * The units per credit of the product.
   */
  unitsPerCredit?: number;

  /**
   * The price amount of the product in its asset (e.g. `10` for 10 XLM).
   */
  priceAmount: number;

  /**
   * The billing interval for subscription products.
   */
  recurringPeriod?: RecurringPeriod;

  /**
   * Number of credits granted when this product is purchased.
   */
  creditsGranted?: number | null;
}

export const productSchema = schemaFor<Product>()(
  z.object({
    id: z.string(),
    organizationId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    images: z.array(z.string()),
    status: productStatusEnum,
    assetId: z.string(),
    type: productTypeEnum,
    createdAt: z.string(),
    updatedAt: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    environment: environmentSchema,
    unit: z.string().optional(),
    unitDivisor: z.number().optional(),
    unitsPerCredit: z.number().optional(),
    priceAmount: z.number(),
    recurringPeriod: recurringPeriodEnum.optional(),
    creditsGranted: z.number().optional(),
    creditExpiryDays: z.number().optional(),
  })
);

export const createProductSchema = productSchema
  .pick({
    name: true,
    description: true,
    images: true,
    type: true,
    assetId: true,
    metadata: true,
    unit: true,
    unitDivisor: true,
    unitsPerCredit: true,
  })
  .extend({
    priceAmount: z.number(),
    recurringPeriod: recurringPeriodEnum.optional(),
    creditsGranted: z.number().optional(),
    creditExpiryDays: z.number().optional(),
  });

export type CreateProduct = z.infer<typeof createProductSchema>;

export const updateProductSchema = productSchema
  .partial()
  .pick({
    name: true,
    description: true,
    images: true,
    metadata: true,
    unit: true,
    unitDivisor: true,
    unitsPerCredit: true,
  })
  .extend({
    priceAmount: z.number().optional(),
    recurringPeriod: recurringPeriodEnum.optional(),
    creditsGranted: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
  });

export type UpdateProduct = z.infer<typeof updateProductSchema>;
