import { z } from "zod";

import { schemaFor } from "../utils";
import { Checkout } from "./checkout";
import { Customer, CustomerWallet } from "./customer";
import { Payment } from "./payment";
import { Refund } from "./refund";
import { Subscription } from "./subscription";

export const WEBHOOK_EVENT_TYPES = [
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "payment_method.created",
  "payment_method.deleted",
  "checkout.created",
  "payment.pending",
  "payment.confirmed",
  "payment.failed",
  "refund.succeeded",
  "refund.failed",
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface Webhook {
  /**
   * The unique identifier for the webhook.
   */
  id: string;

  /**
   * The URL of the webhook.
   */
  url: string;

  /**
   * The secret of the webhook.
   */
  secret: string;

  /**
   * The event types of the webhook.
   */
  events: Array<WebhookEventType>;

  /**
   * The name of the webhook.
   */
  name: string;

  /**
   * The description of the webhook.
   */
  description?: string;

  /**
   * Whether deliveries to this endpoint are suspended.
   */
  is_disabled: boolean;

  /**
   * The created at timestamp for the webhook.
   */
  created_at: string;

  /**
   * The updated at timestamp for the webhook.
   */
  updated_at: string;
}

export const webhookSchema = schemaFor<Webhook>()(
  z.object({
    id: z.string(),
    url: z.string(),
    secret: z.string(),
    events: z.array(z.custom<WebhookEventType>((v) => WEBHOOK_EVENT_TYPES.includes(v as WebhookEventType))),
    name: z.string(),
    description: z.string().optional(),
    is_disabled: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
);

export const createWebhookSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  events: z
    .array(z.custom<WebhookEventType>((v) => WEBHOOK_EVENT_TYPES.includes(v as WebhookEventType)))
    .refine((e) => e.length > 0, { message: "At least one event is required" }),
});

export type CreateWebhook = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  events: z
    .array(z.custom<WebhookEventType>((v) => WEBHOOK_EVENT_TYPES.includes(v as WebhookEventType)))
    .optional()
    .refine((e) => !e || e.length > 0, { message: "At least one event is required" }),
  is_disabled: z.boolean().optional(),
});

export type UpdateWebhook = z.infer<typeof updateWebhookSchema>;

// --- Core Event Envelopes ---

export interface WebhookEventBase<TName extends string, TObject> {
  /**
   * The unique identifier for the event.
   */
  id: string;
  /**
   * The type of the event.
   */
  type: TName;
  /**
   * The created at timestamp for the event.
   */
  created: string;
  /**
   * Whether the event is live or test.
   */
  livemode: boolean;
  /**
   * The data of the event.
   */
  data: {
    /**
     * The resource that triggered the event.
     */
    object: TObject;
    /**
     * The previous attributes of the object (only on *.updated events).
     */
    previous_attributes?: Partial<TObject>;
  };
}

export interface WebhookObjectMap {
  "customer.created": Customer;
  "customer.updated": Customer;
  "customer.deleted": Customer;
  "payment_method.created": CustomerWallet;
  "payment_method.deleted": CustomerWallet;
  "checkout.created": Checkout;
  "payment.confirmed": Payment;
  "payment.pending": Payment;
  "payment.failed": Payment;
  "refund.succeeded": Refund;
  "refund.failed": Refund;
  "subscription.created": Subscription;
  "subscription.updated": Subscription;
  "subscription.canceled": Subscription;
}

export type WebhookEvent = {
  [K in WebhookEventType]: WebhookEventBase<K, WebhookObjectMap[K]>;
}[WebhookEventType];

export type WebhookObject<K extends WebhookEventType> = WebhookObjectMap[K];
