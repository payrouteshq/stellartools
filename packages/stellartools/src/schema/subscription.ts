import { z } from "zod";

import { schemaFor } from "..";
import { ApiVersion } from "../versioning";

export const subscriptionStatusEnum = z.enum(["trialing", "active", "past_due", "overdue", "canceled", "paused"]);

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

  /** Hosted payment URL when the subscription has an outstanding invoice. */
  invoice_url: string | null;

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
    invoice_url: z.string().nullable().default(null),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}),
    trial_days: z.number().default(0),
  })
);

export const CreateSubscriptionSchema_2026_08_18 = z.object({
  customer_id: z.string(),
  product_id: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
  cancel_at_period_end: z.boolean().optional().default(false),
  trial_days: z.number().default(0).optional().nullable(),
});

export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema_2026_08_18>;

export const PauseSubscriptionSchema_2026_08_18 = subscriptionSchema.pick({ id: true });

export type PauseSubscription = Pick<Subscription, "id">;

export const ResumeSubscriptionSchema_2026_08_18 = subscriptionSchema.pick({ id: true });

export type ResumeSubscription = Pick<Subscription, "id">;

export const UpdateSubscriptionSchema_2026_08_18 = z.object({
  metadata: z.record(z.string(), z.any()).optional(),
  cancel_at_period_end: z.boolean().optional(),
});

export type UpdateSubscription = z.infer<typeof UpdateSubscriptionSchema_2026_08_18>;

export const RetrieveSubscriptionSchema_2026_08_18 = z.object({ id: z.string() });
export const ListSubscriptionsSchema_2026_08_18 = z.object({ customerId: z.string() });
export const CancelSubscriptionSchema_2026_08_18 = z.object({ id: z.string() });

export const SUBSCRIPTION_SCHEMAS = {
  "2026-08-18": {
    create: CreateSubscriptionSchema_2026_08_18,
    update: UpdateSubscriptionSchema_2026_08_18,
    pause: PauseSubscriptionSchema_2026_08_18,
    resume: ResumeSubscriptionSchema_2026_08_18,
    retrieve: RetrieveSubscriptionSchema_2026_08_18,
    list: ListSubscriptionsSchema_2026_08_18,
    cancel: CancelSubscriptionSchema_2026_08_18,
  },
} satisfies Record<
  ApiVersion,
  {
    create: z.ZodSchema;
    update: z.ZodSchema;
    pause: z.ZodSchema;
    resume: z.ZodSchema;
    retrieve: z.ZodSchema;
    list: z.ZodSchema;
    cancel: z.ZodSchema;
  }
>;

/** Whether a subscription currently grants product access. */
export const internal$hasSubscriptionAccess = (sub: Pick<Subscription, "status" | "current_period_end">): boolean => {
  if (sub.status === "active" || sub.status === "trialing" || sub.status === "paused") return true;
  if (sub.status === "canceled" && Date.now() < new Date(sub.current_period_end).getTime()) return true;
  return false;
};
