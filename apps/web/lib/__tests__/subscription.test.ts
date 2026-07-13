import { MAX_CONSECUTIVE_FAILED_PAYMENTS, initialSubscriptionStatus, shouldCancelAfterFailures } from "@/lib/subscription";
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

describe("shouldCancelAfterFailures (dunning)", () => {
  it("does not cancel before the failure cap is reached", () => {
    expect(shouldCancelAfterFailures([])).toBe(false);
    expect(shouldCancelAfterFailures(["failed"])).toBe(false);
    expect(shouldCancelAfterFailures(["failed", "failed"])).toBe(false);
  });

  it("cancels after the configured number of consecutive failures", () => {
    const streak = Array.from({ length: MAX_CONSECUTIVE_FAILED_PAYMENTS }, () => "failed");
    expect(shouldCancelAfterFailures(streak)).toBe(true);
  });

  it("a successful payment inside the window resets the streak", () => {
    expect(shouldCancelAfterFailures(["failed", "confirmed", "failed"])).toBe(false);
    expect(shouldCancelAfterFailures(["failed", "failed", "confirmed"])).toBe(false);
  });

  it("only the most recent payments matter", () => {
    expect(shouldCancelAfterFailures(["failed", "failed", "failed", "confirmed"])).toBe(true);
    expect(shouldCancelAfterFailures(["confirmed", "failed", "failed", "failed"])).toBe(false);
  });

  it("respects a custom cap", () => {
    expect(shouldCancelAfterFailures(["failed", "failed"], 2)).toBe(true);
    expect(shouldCancelAfterFailures(["failed"], 2)).toBe(false);
  });
});
