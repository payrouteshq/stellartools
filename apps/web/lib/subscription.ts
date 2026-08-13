import type { SubscriptionStatus } from "@/constant/schema.client";

/** Consecutive failed charges after which a subscription becomes overdue. */
export const MAX_CONSECUTIVE_FAILED_PAYMENTS = 3;

export const initialSubscriptionStatus = (
  trialDays?: number | null,
  explicitStatus?: SubscriptionStatus
): SubscriptionStatus => {
  if (explicitStatus) return explicitStatus;
  return (trialDays ?? 0) > 0 ? "trialing" : "active";
};

/**
 * DECISION: cancel only when the most recent charges are an unbroken
 * run of failures at least `maxFailures` long. A confirmed
 * payment anywhere in the window resets the streak.
 */
export const shouldMarkOverdueAfterFailures = (
  recentStatusesDesc: Array<string>,
  maxFailures: number = MAX_CONSECUTIVE_FAILED_PAYMENTS
): boolean => {
  if (recentStatusesDesc.length < maxFailures) return false;
  return recentStatusesDesc.slice(0, maxFailures).every((status) => status === "failed");
};
