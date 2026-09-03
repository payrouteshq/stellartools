import { RecurringPeriod } from "@stellartools/core";

type ExplicitSubscriptionPeriod = Exclude<RecurringPeriod, "custom">;

export const subscriptionIntervals: Record<ExplicitSubscriptionPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export const MS_PER_DAY = 86_400_000;

export const subscriptionPeriodMs = (
  recurringPeriod: RecurringPeriod | null | undefined,
  customDurationMs?: number | null
): number | null => {
  if (!recurringPeriod) return null;

  if (recurringPeriod === "custom") {
    if (!customDurationMs || customDurationMs <= 0) return null;
    return customDurationMs;
  }

  return subscriptionIntervals[recurringPeriod] * MS_PER_DAY;
};

export const trialEndAt = (from: Date, trialDays: number): Date => new Date(from.getTime() + trialDays * MS_PER_DAY);

export const STELLAR_PRECISION = 7;

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/([^.]+\.)?stellartools\.dev$/,
  /^https?:\/\/([^.]+\.)?stellartools\.site$/,
  /^https?:\/\/([^.]+\.)*localhost(:\d{1,5})?$/,
  /^https?:\/\/([^.]+\.)*127\.0\.0\.1\.nip\.io(:\d{1,5})?$/,
  /^https?:\/\/([^.]+\.)*localhost(:\d{1,5})?$/,
];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const isAllowed = requestOrigin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(requestOrigin));

  return {
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : "https://stellartools.dev",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Credentials": "true",
  };
}

export const stellarExplorerUrl = (hash: string, environment?: string | null) =>
  `https://stellar.expert/explorer/${environment === "mainnet" ? "public" : "testnet"}/tx/${hash}`;

export const TIMELINE_ROUTE_MAP: Record<string, (id: string) => string> = {
  customerId: (id) => `/customers/${id}`,
  productId: (id) => `/products/${id}`,
  paymentId: (id) => `/transactions/${id}`,
  externalUrl: (url) => url,
  deliveryLogId: (id) => `/webhooks/~?eventId=${id}`,
};

export const SENSITIVE_KEY_PREFIX = "__ST_ENC__:";

export const INTERNAL_PRODUCT_ID_SUFFIX = ":-i";
