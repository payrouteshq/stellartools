import { z } from "zod";

import { schemaFor } from "..";

export const subscriptionStatusEnum = z.enum(["trialing", "active", "past_due", "canceled", "paused"]);

type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>;

export interface Subscription {
  /**
   * The unique identifier for the subscription.
   */
  id: string;

  /**
   * The customer ID of the subscription.
   */
  customer_id: string;

  /**
   * The product ID of the subscription.
   */
  product_id: string;

  /**
   * The status of the subscription.
   */
  status: SubscriptionStatus;

  /**
   * The start date of the current period.
   */
  current_period_start: string;

  /**
   * The end date of the current period.
   */
  current_period_end: string;

  /**
   * Whether to cancel the subscription at the end of the current period.
   */
  cancel_at_period_end: boolean;

  /**
   * The date the subscription was canceled.
   */
  canceled_at: string | null;

  /**
   * The date the subscription was paused.
   */
  paused_at: string | null;

  /**
   * The number of failed payments of the subscription.
   */
  failed_payment_count: number | null;

  /**
   * The created at timestamp for the subscription.
   */
  created_at: string | null;

  /**
   * The updated at timestamp for the subscription.
   */
  updated_at: string;

  /**
   * The metadata of the subscription.
   */
  metadata: Record<string, unknown> | null;

  /**
   * The number of trial days for the subscription.
   */
  trial_days: number | null;
}

export const subscriptionSchema = schemaFor<Subscription>()(
  z.object({
    id: z.string(),
    customer_id: z.string(),
    product_id: z.string(),
    status: subscriptionStatusEnum,
    current_period_start: z.string(),
    current_period_end: z.string(),
    cancel_at_period_end: z.boolean(),
    canceled_at: z.string(),
    paused_at: z.string(),
    failed_payment_count: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    trial_days: z.number().default(0),
  })
);

export const createSubscriptionSchema = z.object({
  customer_id: z.string(),
  product_id: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
  cancel_at_period_end: z.boolean().optional().default(false),
  trial_days: z.number().default(0).optional().nullable(),
});

export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;

export const pauseSubscriptionSchema = subscriptionSchema.pick({ id: true });

export type PauseSubscription = Pick<Subscription, "id">;

export const resumeSubscriptionSchema = subscriptionSchema.pick({ id: true });

export type ResumeSubscription = Pick<Subscription, "id">;

export const updateSubscriptionSchema = z.object({
  metadata: z.record(z.string(), z.any()).optional(),
  cancel_at_period_end: z.boolean().optional(),
});

export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
