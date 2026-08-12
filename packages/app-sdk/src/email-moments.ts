import { WebhookEventType } from "@stellartools/core";

export type EmailMoment = {
  event: WebhookEventType;
  label: string;
  description: string;
  /** Shown before "Add more emails" */
  featured?: boolean;
};

/** Single source of truth for marketplace email-mapping UIs. */
export const EMAIL_MOMENTS: EmailMoment[] = [
  {
    event: "customer.created",
    label: "Customer created email",
    description: "Sent when a customer is created",
    featured: true,
  },
  { event: "customer.updated", label: "Profile update email", description: "Sent when a customer’s details change" },
  { event: "customer.deleted", label: "Account closed email", description: "Sent when a customer account is removed" },
  {
    event: "payment_method.created",
    label: "Payment method added email",
    description: "Sent when a customer saves a payment method",
  },
  {
    event: "payment_method.deleted",
    label: "Payment method removed email",
    description: "Sent when a saved payment method is deleted",
  },
  { event: "checkout.created", label: "Checkout started email", description: "Sent when a customer begins checkout" },
  {
    event: "payment.pending",
    label: "Payment pending email",
    description: "Sent when a payment is waiting to complete",
  },
  {
    event: "payment.confirmed",
    label: "Successful payment email",
    description: "Sent when a payment goes through",
    featured: true,
  },
  {
    event: "payment.failed",
    label: "Failed payment email",
    description: "Sent when a payment doesn’t go through",
    featured: true,
  },
  { event: "refund.succeeded", label: "Successful refund email", description: "Sent when a refund is issued" },
  { event: "refund.failed", label: "Refund failed email", description: "Sent when a refund couldn’t be completed" },
  {
    event: "subscription.created",
    label: "Subscription created email",
    description: "Sent when someone starts a subscription",
    featured: true,
  },
  {
    event: "subscription.updated",
    label: "Subscription update email",
    description: "Sent when a plan or status changes",
  },
  {
    event: "subscription.canceled",
    label: "Subscription canceled email",
    description: "Sent when a subscription ends",
  },
];

/** Featured moments by default; pass `all` or `include` for the rest. */
export function listEmailMoments(options?: { all?: boolean; include?: Iterable<string> }): EmailMoment[] {
  const include = new Set(options?.include);
  return EMAIL_MOMENTS.filter((m) => options?.all || m.featured || include.has(m.event));
}

export function emailMomentLabel(event: string): string {
  return EMAIL_MOMENTS.find((m) => m.event === event)?.label ?? event;
}
