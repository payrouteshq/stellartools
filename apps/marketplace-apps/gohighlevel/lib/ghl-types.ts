import { z } from "@stellartools/core";

export const GHL_REQUIRED_SCOPES = [
  "payments/orders.readonly",
  "payments/orders.write",
  "payments/subscriptions.readonly",
  "payments/transactions.readonly",
  "payments/custom-provider.readonly",
  "payments/custom-provider.write",
  "products.readonly",
  "products/prices.readonly",
] as const;

export interface GhlOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  locationId?: string;
  companyId?: string;
  userType?: "Location" | "Company";
}

export const GhlPaymentProviderTypeSchema = z.enum(["OneTime", "Recurring", "OffSession"]);

export interface GhlProviderConfigInput {
  name: string;
  description: string;
  imageUrl: string;
  locationId: string;
  queryUrl: string;
  paymentsUrl: string;
}

export interface GhlConnectConfigInput {
  locationId: string;
  /** At least one of `live`/`test` must be set — HighLevel's Connect Config API is called once per mode. */
  live?: { apiKey: string; publishableKey: string };
  test?: { apiKey: string; publishableKey: string };
}

export const ChargeSnapshotSchema = z.object({
  id: z.string().optional(),
  status: z.enum(["succeeded", "failed", "pending", "processing"]),
  amount: z.number(),
  chargeId: z.string(),
  currency: z.string().optional(),
  createdAt: z.number().optional(),
  chargedAt: z.number().optional(),
});

export type GhlChargeSnapshot = z.infer<typeof ChargeSnapshotSchema>;

export const SubscriptionSnapshotSchema = z.object({
  id: z.string(),
  status: z.enum(["scheduled", "trialing", "active", "expired", "canceled", "unpaid", "incomplete", "pending"]),
  trialEnd: z.number().optional(),
  createdAt: z.number().optional(),
  nextCharge: z.number().optional(),
});

export type GhlSubscriptionSnapshot = z.infer<typeof SubscriptionSnapshotSchema>;

export const PriceSchema = z.object({
  _id: z.string(),
  name: z.string(),
  type: z.enum(["onetime", "recurring"]),
  currency: z.string(),
  amount: z.number(),
  compareAtPrice: z.number().optional(),
  setupFee: z.number().optional(),
  recurring: z.object({ interval: z.enum(["day", "week", "month", "year"]), intervalCount: z.number() }).optional(),
  trialPeriod: z.number().optional(),
  totalCycles: z.number().optional(),
});

export const ProductDetailSchema = z.object({
  _id: z.string(),
  name: z.string(),
  qty: z.number(),
  productId: z.string(),
  priceId: z.string(),
  prices: z.array(PriceSchema),
});

export const VerifyRequestSchema = z.object({
  type: z.literal("verify"),
  transactionId: z.string(),
  apiKey: z.string(),
  chargeId: z.string(),
  subscriptionId: z.string().optional(),
});

export const ListPaymentMethodsRequestSchema = z.object({
  type: z.literal("list_payment_methods"),
  locationId: z.string(),
  contactId: z.string(),
  apiKey: z.string(),
});

export const ChargePaymentRequestSchema = z.object({
  type: z.literal("charge_payment"),
  paymentMethodId: z.string(),
  contactId: z.string(),
  transactionId: z.string(),
  chargeDescription: z.string().optional(),
  amount: z.number(),
  currency: z.string(),
  apiKey: z.string(),
});

export const CreateSubscriptionRequestSchema = z.object({
  type: z.literal("create_subscription"),
  apiKey: z.string(),
  locationId: z.string(),
  contactId: z.string(),
  paymentMethodId: z.string().optional(),
  subscriptionId: z.string(),
  transactionId: z.string(),
  startDate: z.string(),
  currency: z.string(),
  amount: z.number(),
  recurringAmount: z.union([z.string(), z.number()]),
  isSchedule: z.boolean().optional(),
  productDetails: z.array(ProductDetailSchema),
});

export const CancelSubscriptionRequestSchema = z.object({
  type: z.literal("cancel_subscription"),
  subscriptionId: z.string(),
  apiKey: z.string(),
});

export const RefundRequestSchema = z.object({
  type: z.literal("refund"),
  amount: z.number(),
  transactionId: z.string(),
  chargeId: z.string(),
  apiKey: z.string(),
});

export const GhlQueryRequestSchema = z.discriminatedUnion("type", [
  VerifyRequestSchema,
  ListPaymentMethodsRequestSchema,
  ChargePaymentRequestSchema,
  CreateSubscriptionRequestSchema,
  CancelSubscriptionRequestSchema,
  RefundRequestSchema,
]);

export type GhlQueryRequest = z.infer<typeof GhlQueryRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type ListPaymentMethodsRequest = z.infer<typeof ListPaymentMethodsRequestSchema>;
export type ChargePaymentRequest = z.infer<typeof ChargePaymentRequestSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>;
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>;
export type RefundRequest = z.infer<typeof RefundRequestSchema>;

export interface GhlPaymentMethod {
  id: string;
  type: "card" | "us_bank_account" | string;
  title: string;
  subTitle: string;
  expiry?: string;
  customerId: string;
  imageUrl?: string;
}

export type VerifyResponse = { success: true } | { failed: true } | { success: false };

export interface ChargePaymentResponse {
  success: boolean;
  failed: boolean;
  chargeId?: string;
  message: string;
  chargeSnapshot?: GhlChargeSnapshot;
}

export interface CreateSubscriptionResponse {
  success: boolean;
  failed: boolean;
  message: string;
  transaction?: { chargeId: string; chargeSnapshot: GhlChargeSnapshot };
  subscription: { subscriptionId: string; subscriptionSnapshot: GhlSubscriptionSnapshot };
}

export interface CancelSubscriptionResponse {
  status: "canceled";
}

export interface RefundResponse {
  success: boolean;
  message: string;
  id?: string;
  amount?: number;
  currency?: string;
}

export type GhlQueryResponse =
  | VerifyResponse
  | GhlPaymentMethod[]
  | ChargePaymentResponse
  | CreateSubscriptionResponse
  | CancelSubscriptionResponse
  | RefundResponse;

// The paymentsUrl iframe postMessage protocol lives in apps/web/lib/ghl-iframe.ts now that the
// checkout UI itself moved there — this file only needs the queryUrl/webhook contract.

export const GHL_WEBHOOK_URL = "https://backend.leadconnectorhq.com/payments/custom-provider/webhook";

export type GhlOutboundWebhookEvent =
  | "subscription.trialing"
  | "subscription.active"
  | "subscription.updated"
  | "subscription.charged"
  | "payment.captured";

export interface GhlOutboundWebhookPayload {
  event: GhlOutboundWebhookEvent;
  apiKey: string;
  locationId: string;
  marketplaceAppId?: string;
  chargeId?: string;
  ghlTransactionId?: string;
  ghlSubscriptionId?: string;
  chargeSnapshot?: GhlChargeSnapshot;
  subscriptionSnapshot?: GhlSubscriptionSnapshot;
}
