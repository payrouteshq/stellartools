import { StellarTools, signJwt, verifyJwt } from "@stellartools/core";
import { timingSafeEqual } from "node:crypto";

import {
  CancelSubscriptionResponse,
  ChargePaymentResponse,
  CreateSubscriptionResponse,
  GHL_REQUIRED_SCOPES,
  GHL_WEBHOOK_URL,
  GhlChargeSnapshot,
  GhlConnectConfigInput,
  GhlOAuthTokenResponse,
  GhlOutboundWebhookEvent,
  GhlOutboundWebhookPayload,
  GhlProviderConfigInput,
  GhlQueryRequest,
  GhlQueryRequestSchema,
  GhlQueryResponse,
  GhlSubscriptionSnapshot,
  RefundResponse,
  VerifyResponse,
} from "./ghl-types";

// ── HighLevel's own API: OAuth, provider registration, outbound webhook ─────

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const PROVIDER_CONFIG_PATH = "/payments/custom-provider/provider";
const CONNECT_CONFIG_PATH = "/payments/custom-provider/config";
const CAPABILITIES_PATH = "/payments/custom-provider/update-capabilities";
const OAUTH_TOKEN_PATH = "/oauth/token";

async function ghlFetch<T>(
  accessToken: string,
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(init?.query ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HighLevel API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function exchangeGhlAuthorizationCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<GhlOAuthTokenResponse> {
  const res = await fetch(API_BASE + OAUTH_TOKEN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      user_type: "Location",
      redirect_uri: params.redirectUri,
    }),
  });

  if (!res.ok) throw new Error(`HighLevel OAuth code exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as GhlOAuthTokenResponse;
}

export async function refreshGhlAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GhlOAuthTokenResponse> {
  const res = await fetch(API_BASE + OAUTH_TOKEN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      user_type: "Location",
    }),
  });

  if (!res.ok) throw new Error(`HighLevel OAuth token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as GhlOAuthTokenResponse;
}

export async function createGhlProviderConfig(accessToken: string, input: GhlProviderConfigInput): Promise<void> {
  await ghlFetch(accessToken, PROVIDER_CONFIG_PATH, {
    method: "POST",
    query: { locationId: input.locationId },
    body: input,
  });
}

export async function deleteGhlProviderConfig(accessToken: string, locationId: string): Promise<void> {
  await ghlFetch(accessToken, PROVIDER_CONFIG_PATH, { method: "DELETE", query: { locationId } });
}

export async function connectGhlProviderConfig(accessToken: string, input: GhlConnectConfigInput): Promise<void> {
  if (!input.live && !input.test) throw new Error("connectGhlProviderConfig requires at least one of live/test");

  await ghlFetch(accessToken, CONNECT_CONFIG_PATH, {
    method: "POST",
    query: { locationId: input.locationId },
    body: { ...(input.live ? { live: input.live } : {}), ...(input.test ? { test: input.test } : {}) },
  });
}

/** Declares support for HighLevel admins creating manual subscription schedules through this provider. */
export async function enableGhlManualSubscriptions(
  accessToken: string,
  target: { locationId: string } | { companyId: string }
): Promise<void> {
  await ghlFetch(accessToken, CAPABILITIES_PATH, {
    method: "POST",
    body: { ...target, capabilities: { manualSubscriptions: true } },
  });
}

export async function sendGhlCustomProviderWebhook(payload: GhlOutboundWebhookPayload): Promise<void> {
  const res = await fetch(GHL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok)
    throw new Error(`HighLevel webhook delivery failed (${res.status}): ${await res.text().catch(() => "")}`);
}

// ── Connect flow: links a StellarTools org to a GHL location via OAuth `state` ──

const AUTHORIZE_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";
const STATE_TOKEN_ISSUER = "stellartools-ghl-connect";

export function buildGhlAuthorizeUrl(params: { clientId: string; redirectUri: string; state?: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", GHL_REQUIRED_SCOPES.join(" "));
  if (params.state) url.searchParams.set("state", params.state);
  return url.toString();
}

/** Carries a StellarTools app token through GHL's OAuth `state` round-trip so `/install` can auto-provision it. Signed and verified with our own secret only — no cross-app sharing needed. */
export function signGhlConnectState(stellarAppToken: string, secret: string): string {
  return signJwt({ stellarAppToken }, "10m", secret, STATE_TOKEN_ISSUER);
}

export function verifyGhlConnectState(token: string, secret: string): string {
  return verifyJwt<{ stellarAppToken: string }>(token, secret, STATE_TOKEN_ISSUER).stellarAppToken;
}

// ── queryUrl dispatcher: HighLevel calling us (verify/charge/refund/subscriptions) ──

export function verifyGhlApiKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface CreateSubscriptionScheduleInput {
  ghlSubscriptionId: string;
  locationId: string;
  contactId: string;
  amountCents: number;
  currencyCode: string;
  intervalDays: number;
  startDate: string;
}

export interface GhlQueryHandlerDeps {
  stellar: StellarTools;
  /** No "get payment by checkout id" lookup exists on the public SDK — the host app fills this in from `payment.confirmed` webhooks. */
  resolvePaymentId: (checkoutId: string) => Promise<string | null>;
  createSubscriptionSchedule: (
    input: CreateSubscriptionScheduleInput
  ) => Promise<{ status: "scheduled" | "trialing"; nextChargeAt: Date }>;
  cancelSubscriptionSchedule: (ghlSubscriptionId: string) => Promise<void>;
}

function mapCheckoutStatusToVerify(status: string): VerifyResponse {
  if (status === "completed") return { success: true };
  if (status === "expired" || status === "failed") return { failed: true };
  return { success: false };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function intervalToMs(interval: string, count: number): number {
  const days: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
  return (days[interval] ?? 30) * count * MS_PER_DAY;
}

function intervalToDays(interval: string, count: number): number {
  return intervalToMs(interval, count) / MS_PER_DAY;
}

export async function handleGhlQuery(
  body: unknown,
  expectedApiKey: string,
  deps: GhlQueryHandlerDeps
): Promise<GhlQueryResponse> {
  const request: GhlQueryRequest = GhlQueryRequestSchema.parse(body);

  if (!verifyGhlApiKey(request.apiKey, expectedApiKey)) {
    throw new Error("Invalid apiKey");
  }

  switch (request.type) {
    case "verify": {
      const checkout = await deps.stellar.checkouts.retrieve(request.chargeId);
      const ghlTxId = checkout.metadata?.ghl_transaction_id;
      if (ghlTxId && ghlTxId !== request.transactionId) return { failed: true };
      return mapCheckoutStatusToVerify(checkout.status);
    }

    case "list_payment_methods": {
      // Stellar payments are customer-signed on-chain transactions, not reusable tokens.
      return [];
    }

    case "charge_payment": {
      const response: ChargePaymentResponse = {
        success: false,
        failed: true,
        message: "Saved payment methods are not supported; the customer must complete a new checkout.",
      };
      return response;
    }

    case "create_subscription": {
      const price = request.productDetails[0]?.prices?.[0];
      const intervalDays = price?.recurring
        ? intervalToDays(price.recurring.interval, price.recurring.intervalCount)
        : 30;

      const schedule = await deps.createSubscriptionSchedule({
        ghlSubscriptionId: request.subscriptionId,
        locationId: request.locationId,
        contactId: request.contactId,
        amountCents: Math.round(Number(request.recurringAmount) * 100),
        currencyCode: request.currency,
        intervalDays,
        startDate: request.startDate,
      });

      const subscriptionSnapshot: GhlSubscriptionSnapshot = {
        id: request.subscriptionId,
        status: schedule.status,
        createdAt: Math.floor(Date.now() / 1000),
        nextCharge: Math.floor(schedule.nextChargeAt.getTime() / 1000),
      };

      const response: CreateSubscriptionResponse = {
        success: true,
        failed: false,
        message: "Subscription scheduled; the customer will be prompted to pay each billing cycle.",
        subscription: { subscriptionId: request.subscriptionId, subscriptionSnapshot },
      };
      return response;
    }

    case "cancel_subscription": {
      await deps.cancelSubscriptionSchedule(request.subscriptionId);
      const response: CancelSubscriptionResponse = { status: "canceled" };
      return response;
    }

    case "refund": {
      const paymentId = await deps.resolvePaymentId(request.chargeId);
      if (!paymentId) {
        const response: RefundResponse = { success: false, message: "No payment found for this charge." };
        return response;
      }

      const payment = await deps.stellar.payments.retrieve(paymentId);
      const requestedCents = Math.round(request.amount * 100);
      if (requestedCents !== payment.amount_cents) {
        const response: RefundResponse = {
          success: false,
          message: `Partial refunds are not supported; refund must equal the full charge amount (${(payment.amount_cents / 100).toFixed(2)} ${payment.currency_code}).`,
        };
        return response;
      }

      const refund = await deps.stellar.refunds.create({
        payment_id: paymentId,
        reason: "HighLevel refund request",
        metadata: { ghl_transaction_id: request.transactionId, source: "GHL app" },
      });

      const response: RefundResponse = {
        success: true,
        message: "Refund successful",
        id: refund.id,
        amount: request.amount,
        currency: payment.currency_code,
      };
      return response;
    }
  }
}

// ── Outbound webhook payload builders (StellarTools payment.confirmed → HighLevel) ──

export function chargeSnapshotFromPayment(payment: {
  id: string;
  status: string;
  amount_cents: number;
  currency_code: string;
  created_at: string;
}): GhlChargeSnapshot {
  const statusMap: Record<string, GhlChargeSnapshot["status"]> = {
    confirmed: "succeeded",
    pending: "pending",
    failed: "failed",
  };

  return {
    id: payment.id,
    chargeId: payment.id,
    status: statusMap[payment.status] ?? "pending",
    amount: payment.amount_cents,
    currency: payment.currency_code,
    createdAt: Math.floor(new Date(payment.created_at).getTime() / 1000),
    chargedAt: Math.floor(new Date(payment.created_at).getTime() / 1000),
  };
}

export function buildPaymentCapturedWebhook(input: {
  apiKey: string;
  locationId: string;
  ghlTransactionId: string;
  chargeSnapshot: GhlChargeSnapshot;
  marketplaceAppId?: string;
}): GhlOutboundWebhookPayload {
  return {
    event: "payment.captured" satisfies GhlOutboundWebhookEvent,
    apiKey: input.apiKey,
    locationId: input.locationId,
    ghlTransactionId: input.ghlTransactionId,
    chargeId: input.chargeSnapshot.chargeId,
    chargeSnapshot: input.chargeSnapshot,
    marketplaceAppId: input.marketplaceAppId,
  };
}

export function buildSubscriptionChargedWebhook(input: {
  apiKey: string;
  locationId: string;
  ghlSubscriptionId: string;
  chargeSnapshot: GhlChargeSnapshot;
  subscriptionSnapshot: GhlSubscriptionSnapshot;
  marketplaceAppId?: string;
}): GhlOutboundWebhookPayload {
  return {
    event: "subscription.charged" satisfies GhlOutboundWebhookEvent,
    apiKey: input.apiKey,
    locationId: input.locationId,
    ghlSubscriptionId: input.ghlSubscriptionId,
    chargeId: input.chargeSnapshot.chargeId,
    chargeSnapshot: input.chargeSnapshot,
    subscriptionSnapshot: input.subscriptionSnapshot,
    marketplaceAppId: input.marketplaceAppId,
  };
}
