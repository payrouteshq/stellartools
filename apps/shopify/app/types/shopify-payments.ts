/**
 * Canonical TypeScript types for Shopify Payments Extension endpoints.
 * Source: https://shopify.dev/docs/apps/build/payments/request-reference
 *
 * Security model:
 *   - Payment/refund/capture/void requests → authenticated via mTLS (infrastructure level)
 *   - HMAC is NOT used for payment operation requests (only for app installation)
 *   - Idempotency key is body.id, NOT the Shopify-Request-Id header
 */

// ─── Shared sub-types ────────────────────────────────────────────────────────

export interface ShopifyAddress {
  given_name?: string;
  family_name: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code?: string;
  province?: string;
  province_code?: string;
  /** ISO 3166-1 Alpha-2 */
  country_code: string;
  phone_number?: string;
  company?: string;
}

export interface ShopifyCustomer {
  /** Required if phone_number is absent */
  email?: string;
  /** Required if email is absent */
  phone_number?: string;
  /** ISO 639-1 language + ISO 3166-1 Alpha-2 country, e.g. "en-US" */
  locale: string;
  billing_address?: ShopifyAddress;
  /** Omitted for digital/virtual products */
  shipping_address?: ShopifyAddress;
}

export interface ShopifyLocalizedField {
  key: string;
  country_code: string;
  value: string;
}

export interface ShopifyTransactionMetadata {
  shipping?: { price: string; discount: string };
  tax_amount?: string;
  order_level_discount?: string;
  /** Country-specific fields (e.g. CPF for Brazil) — API 2024-07+ */
  localized_fields?: ShopifyLocalizedField[];
}

/** Sent only for 3-D Secure credit card flows */
export interface ShopifyClientDetails {
  ip_address: string;
  user_agent: string;
  accept_language?: string;
}

// ─── Payment method variants ──────────────────────────────────────────────────

export interface ShopifyOffsitePaymentMethod {
  type: "offsite";
  data: {
    /** URL to redirect the customer to if they cancel on our hosted page */
    cancel_url: string;
  };
}

/** Not used in our offsite flow; included for completeness */
export interface ShopifyCreditCardPaymentMethod {
  type: "credit_card";
  data: {
    fingerprint: string;
    encrypted_message: string;
    ephemeral_public_key: string;
    tag: string;
    /** Mail-Order/Telephone-Order flag — API 2024-07+ */
    moto: boolean;
  };
}

export type ShopifyPaymentMethod = ShopifyOffsitePaymentMethod | ShopifyCreditCardPaymentMethod;

// ─── Endpoint request bodies ──────────────────────────────────────────────────

export interface ShopifyPaymentSessionRequest {
  /**
   * Unique payment attempt identifier — use this as your internal idempotency key.
   * NOT the same as Shopify-Request-Id (which is only for logging/tracing).
   */
  id: string;
  /** GraphQL-compatible payment GID */
  gid: string;
  /** Shared across all payment sessions for the same checkout */
  group: string;
  /** Sessions with identical payment details share this ID — API 2024-10+ */
  session_id?: string;
  /** Dot-separated decimal regardless of locale, e.g. "49.99" */
  amount: string;
  /** ISO 4217, e.g. "USD" */
  currency: string;
  test: boolean;
  /** IETF BCP 47, e.g. "en-CA" */
  merchant_locale: string;
  /** ISO-8601 */
  proposed_at: string;
  kind: "sale" | "authorization";
  customer?: ShopifyCustomer;
  payment_method: ShopifyPaymentMethod;
  transaction_metadata?: ShopifyTransactionMetadata;
  /** 3-D Secure only */
  client_details?: ShopifyClientDetails;
}

export interface ShopifyRefundSessionRequest {
  /** Idempotency key */
  id: string;
  gid: string;
  /** GID of the original PaymentSession — NOT a capture GID */
  payment_id: string;
  amount: string;
  currency: string;
  test: boolean;
  merchant_locale: string;
  proposed_at: string;
}

export interface ShopifyCaptureSessionRequest {
  id: string;
  gid: string;
  payment_id: string;
  amount: string;
  currency: string;
  test: boolean;
  merchant_locale: string;
  proposed_at: string;
}

export interface ShopifyVoidSessionRequest {
  id: string;
  gid: string;
  payment_id: string;
  test: boolean;
  merchant_locale: string;
  proposed_at: string;
}
