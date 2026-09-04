import { z } from "@stellartools/core";

/**
 * HighLevel's `paymentsUrl` postMessage contract — see
 * https://help.gohighlevel.com/support/solutions/articles/155000002620-how-to-build-a-custom-payments-integration-on-the-platform
 * Kept minimal and duplicated (not shared via a package) with `apps/marketplace-apps/gohighlevel/lib/ghl-types.ts`,
 * which owns the full queryUrl/webhook contract — this file only needs the iframe messages.
 */

const ContactSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.email().optional(),
  contact: z.string().optional(),
});

export const PaymentInitiatePropsSchema = z.object({
  type: z.literal("payment_initiate_props"),
  publishableKey: z.string(),
  amount: z.number(),
  currency: z.string(),
  mode: z.enum(["payment", "subscription"]),
  // Only used server-side (to price a hidden subscription product) — kept loose here since this
  // page just forwards it on, rather than duplicating the marketplace app's detailed price shape.
  productDetails: z.array(z.record(z.string(), z.any())).optional(),
  contact: ContactSchema,
  orderId: z.string().optional(),
  transactionId: z.string(),
  subscriptionId: z.string().optional(),
  locationId: z.string(),
});

export type PaymentInitiateProps = z.infer<typeof PaymentInitiatePropsSchema>;

export const SetupInitiatePropsSchema = z.object({
  type: z.literal("setup_initiate_props"),
  publishableKey: z.string(),
  mode: z.literal("setup"),
  contact: ContactSchema,
  locationId: z.string(),
});

const IframeInboundMessageSchema = z.discriminatedUnion("type", [PaymentInitiatePropsSchema, SetupInitiatePropsSchema]);

export type IframeInboundMessage = z.infer<typeof IframeInboundMessageSchema>;

export function parseGhlIframeMessage(data: unknown): IframeInboundMessage | null {
  const result = IframeInboundMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function buildReadyMessage() {
  return { type: "custom_provider_ready" as const, loaded: true, addCardOnFileSupported: false };
}

export function buildSuccessMessage(chargeId: string) {
  return { type: "custom_element_success_response" as const, chargeId };
}

export function buildErrorMessage(description: string) {
  return { type: "custom_element_error_response" as const, error: { description } };
}

export function buildCloseMessage() {
  return { type: "custom_element_close_response" as const };
}
