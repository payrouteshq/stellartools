import type { SubscriptionStatus } from "@/constant/schema.client";

export const MAX_CONSECUTIVE_FAILED_PAYMENTS_BEFORE_MARKED_AS_OVERDUE = 3;

export const initialSubscriptionStatus = (
  trialDays?: number | null,
  explicitStatus?: SubscriptionStatus
): SubscriptionStatus => {
  if (explicitStatus) return explicitStatus;
  return (trialDays ?? 0) > 0 ? "trialing" : "active";
};

export const shouldMarkOverdueAfterFailures = (
  recentStatusesDesc: Array<string>,
  maxFailures: number = MAX_CONSECUTIVE_FAILED_PAYMENTS_BEFORE_MARKED_AS_OVERDUE
): boolean => {
  if (recentStatusesDesc.length < maxFailures) return false;
  return recentStatusesDesc.slice(0, maxFailures).every((status) => status === "failed");
};
