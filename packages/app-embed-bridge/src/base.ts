export const APP_CONFIG = {
  customers: {
    label: "Customers",
    events: ["customer::created", "customer::updated"] as const,
  },
  payments: {
    label: "Payments",
    events: ["payment::completed", "payment::failed"] as const,
  },
  checkouts: {
    label: "Checkouts",
    events: ["checkout::created", "checkout::updated"] as const,
  },
  subscriptions: {
    label: "Subscriptions",
    events: [
      "subscription::created",
      "subscription::updated",
      "subscription::deleted",
      "subscription::canceled",
    ] as const,
  },
  refunds: {
    label: "Refunds",
    events: ["refund::created", "refund::failed"] as const,
  },
  payouts: {
    label: "Payouts",
    events: ["payout::requested", "payout::processed"] as const,
  },
  payment_methods: {
    label: "Payment Methods",
    events: ["payment_method::created", "payment_method::deleted"] as const,
  },
  portal: {
    label: "Customer Portal",
    events: ["customer_portal_session::created"] as const,
  },
  products: { label: "Products", events: [] as const },
  webhooks: { label: "Webhooks", events: [] as const },
  assets: { label: "Assets", events: [] as const },
  api_keys: { label: "API Keys", events: [] as const },
} as const;

export type AppResource = keyof typeof APP_CONFIG;

export const eventTypeEnum = Object.values(APP_CONFIG).flatMap((v) => v.events);

export type EventType = (typeof eventTypeEnum)[number];

export type AppScope = `read:${AppResource}` | "*";
