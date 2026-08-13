import {
  MAX_CONSECUTIVE_FAILED_PAYMENTS,
  initialSubscriptionStatus,
  shouldMarkOverdueAfterFailures,
} from "@/lib/subscription";
import { describe, expect, it } from "vitest";

describe("initialSubscriptionStatus", () => {
  it("starts as trialing when trial days are set", () => {
    expect(initialSubscriptionStatus(7)).toBe("trialing");
    expect(initialSubscriptionStatus(1)).toBe("trialing");
  });

  it("starts as active without trial days", () => {
    expect(initialSubscriptionStatus(0)).toBe("active");
    expect(initialSubscriptionStatus(undefined)).toBe("active");
    expect(initialSubscriptionStatus(null)).toBe("active");
  });

  it("does not treat negative trial days as a trial", () => {
    expect(initialSubscriptionStatus(-3)).toBe("active");
  });

  it("lets an explicit status override the trial derivation", () => {
    expect(initialSubscriptionStatus(7, "active")).toBe("active");
    expect(initialSubscriptionStatus(0, "past_due")).toBe("past_due");
    expect(initialSubscriptionStatus(0, "canceled")).toBe("canceled");
  });
});

describe("shouldMarkOverdueAfterFailures (dunning)", () => {
  it("does not become overdue before the failure cap is reached", () => {
    expect(shouldMarkOverdueAfterFailures([])).toBe(false);
    expect(shouldMarkOverdueAfterFailures(["failed"])).toBe(false);
    expect(shouldMarkOverdueAfterFailures(["failed", "failed"])).toBe(false);
  });

  it("becomes overdue after the configured number of consecutive failures", () => {
    const streak = Array.from({ length: MAX_CONSECUTIVE_FAILED_PAYMENTS }, () => "failed");
    expect(shouldMarkOverdueAfterFailures(streak)).toBe(true);
  });

  it("a successful payment inside the window resets the streak", () => {
    expect(shouldMarkOverdueAfterFailures(["failed", "confirmed", "failed"])).toBe(false);
    expect(shouldMarkOverdueAfterFailures(["failed", "failed", "confirmed"])).toBe(false);
  });

  it("only the most recent payments matter", () => {
    expect(shouldMarkOverdueAfterFailures(["failed", "failed", "failed", "confirmed"])).toBe(true);
    expect(shouldMarkOverdueAfterFailures(["confirmed", "failed", "failed", "failed"])).toBe(false);
  });

  it("respects a custom cap", () => {
    expect(shouldMarkOverdueAfterFailures(["failed", "failed"], 2)).toBe(true);
    expect(shouldMarkOverdueAfterFailures(["failed"], 2)).toBe(false);
  });
});
