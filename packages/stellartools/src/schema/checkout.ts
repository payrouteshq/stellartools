import { z } from "zod";

import { schemaFor } from "../utils";
import { CURRENCY_CODES } from "./currencies";
import { Environment, environmentSchema } from "./shared";

export const checkoutStatusEnum = z.enum(["open", "completed", "expired", "failed"]);

export type CheckoutStatus = z.infer<typeof checkoutStatusEnum>;

export type SubscriptionData = {
  /**
   * The start date of the subscription.
   */
  period_start: string;

  /**
   * The end date of the subscription.
   */
  period_end: string;

  /**
   * Whether to cancel the subscription at the end of the current period.
   */
  cancel_at_period_end?: boolean;
};

export interface Checkout {
  /**
   * The unique identifier for the checkout.
   */
  id: string;

  /**
   * The customer ID of the checkout.
   */
  customer_id: string;

  /**
   * The product ID of the checkout.
   */
  product_id?: string;

  /**
   * The amount of the checkout.
   */
  amount_cents?: number;

  /**
   * The asset code of the checkout.
   */
  currency_code?: string;

  /**
   * The description of the checkout.
   */
  description?: string;

  /**
   * The status of the checkout.
   */
  status: CheckoutStatus;

  /**
   * The payment URL of the checkout.
   */
  payment_url: string;

  /**
   * The expiration date of the checkout.
   */
  expires_at: string;

  /**
   * The created date of the checkout.
   */
  created_at: string;

  /**
   * The updated date of the checkout.
   */
  updated_at: string;

  /**
   * The metadata of the checkout.
   */
  metadata: Record<string, unknown>;

  /**
   * The environment of the checkout.
   */
  environment: Environment;

  /**
   * URL to redirect the customer to after payment (e.g. thank-you page).
   */
  redirect_url?: string;

  /**
   * The subscription data of the checkout.
   */
  subscription_data?: SubscriptionData;
}

export const subscriptionDataSchema = schemaFor<SubscriptionData>()(
  z.object({
    period_start: z.string(),
    period_end: z.string(),
    cancel_at_period_end: z.boolean().default(false).optional(),
  })
);

export const checkoutSchema = schemaFor<Checkout>()(
  z.object({
    id: z.string(),
    customer_id: z.string(),
    product_id: z.string().optional(),
    amount_cents: z.number().optional(),
    description: z.string().optional(),
    currency_code: z.string().optional(),
    status: checkoutStatusEnum,
    payment_url: z.string(),
    expires_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    environment: environmentSchema,
    redirect_url: z.string().optional(),
    subscription_data: subscriptionDataSchema.optional(),
  })
);

const baseCreateSchema = z.object({
  customer_id: z.string().optional(),
  customer_email: z.email().optional(),
  customer_phone: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  redirect_url: z.string().optional(),
});

export const createCheckoutSchema = baseCreateSchema.extend({
  product_id: z.string().min(1, "Product ID is required"),
});

export const currencyCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(CURRENCY_CODES, { message: "Invalid currency code, must be one of " + CURRENCY_CODES.join(", ") }));

export const createDirectCheckoutSchema = baseCreateSchema.extend({
  amount_cents: z.number().positive("Amount must be greater than 0"),
  currency_code: currencyCodeSchema,
});

export type CreateCheckout = z.infer<typeof createCheckoutSchema>;
export type CreateDirectCheckout = z.infer<typeof createDirectCheckoutSchema>;

export const updateCheckoutSchema = z.object({
  status: checkoutStatusEnum.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateCheckout = z.infer<typeof updateCheckoutSchema>;

export const retrieveCheckoutSchema = checkoutSchema.pick({
  id: true,
});
