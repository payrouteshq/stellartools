import {
  computeDiff,
  generateResourceId,
  maskData,
  normalizeTimeSeries,
  toCamelCase,
  toSnakeCase,
  truncate,
  unmaskData,
} from "@/lib/utils";
import moment from "moment";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", () => ({ pdf: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

describe("computeDiff", () => {
  it("returns null when nothing changed", () => {
    expect(computeDiff({ a: 1, b: "x" }, { a: 1, b: "x" })).toBeNull();
  });

  it("captures changed keys with their previous values", () => {
    const diff = computeDiff({ status: "active", plan: "pro" }, { status: "canceled", plan: "pro" });
    expect(diff).toEqual({
      data: { status: "canceled" },
      previous_attributes: { status: "active" },
    });
  });

  it("ignores updatedAt/createdAt/id by default", () => {
    expect(computeDiff({ id: "1", updatedAt: "a", createdAt: "b" }, { id: "2", updatedAt: "c", createdAt: "d" })).toBeNull();
  });

  it("normalizes undefined values to null", () => {
    const diff = computeDiff({ canceledAt: "2026-01-01" } as Record<string, unknown>, { canceledAt: undefined });
    expect(diff?.data).toEqual({ canceledAt: null });
    expect(diff?.previous_attributes).toEqual({ canceledAt: "2026-01-01" });
  });

  it("compares bigint values without throwing", () => {
    const diff = computeDiff({ amount: BigInt(100) }, { amount: BigInt(200) });
    expect(diff?.data).toEqual({ amount: BigInt(200) });
  });

  it("deep-diffs nested objects when a delimiter is provided", () => {
    const diff = computeDiff({ metadata: { tier: "gold", region: "eu" } }, { metadata: { tier: "silver", region: "eu" } }, [], ".");
    expect(diff?.data).toEqual({ tier: "silver" });
    expect(diff?.previous_attributes).toEqual({ tier: "gold" });
  });

  it("treats nested objects as atomic without a delimiter", () => {
    const diff = computeDiff({ metadata: { tier: "gold" } }, { metadata: { tier: "silver" } });
    expect(diff?.data).toEqual({ metadata: { tier: "silver" } });
  });
});

describe("case conversion", () => {
  it("toSnakeCase converts nested objects and arrays", () => {
    expect(toSnakeCase({ checkoutId: "c1", lineItems: [{ productId: "p1" }] })).toEqual({
      checkout_id: "c1",
      line_items: [{ product_id: "p1" }],
    });
  });

  it("toSnakeCase leaves non-plain objects (dates) intact", () => {
    const date = new Date("2026-01-01");
    expect(toSnakeCase({ createdAt: date })).toEqual({ created_at: date });
  });

  it("toCamelCase reverses snake_case keys", () => {
    expect(toCamelCase({ checkout_id: "c1", line_items: [{ product_id: "p1" }] })).toEqual({
      checkoutId: "c1",
      lineItems: [{ productId: "p1" }],
    });
  });
});

describe("truncate", () => {
  it("returns short strings untouched", () => {
    expect(truncate("GABC")).toBe("GABC");
    expect(truncate("")).toBe("");
  });

  it("truncates long strings keeping start and end", () => {
    expect(truncate("GABCDEFGHIJKLMNOP")).toBe("GABCDE...MNOP");
  });

  it("honours custom start/end/separator", () => {
    expect(truncate("0123456789", { start: 2, end: 2, separator: "~" })).toBe("01~89");
  });
});

describe("normalizeTimeSeries (dashboard charts)", () => {
  it("produces exactly `count` points ending today, zero-filling gaps", () => {
    const result = normalizeTimeSeries([], 7, "day");
    expect(result).toHaveLength(7);
    expect(result.every((p) => p.value === 0)).toBe(true);
    expect(result[6].i).toBe(moment().format("YYYY-MM-DD"));
    expect(result[0].i).toBe(moment().subtract(6, "day").format("YYYY-MM-DD"));
  });

  it("maps values from matching dates", () => {
    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");
    const result = normalizeTimeSeries(
      [
        { date: today, value: 5 },
        { date: yesterday, value: 3 },
      ],
      3,
      "day"
    );
    expect(result[2]).toEqual({ i: today, value: 5 });
    expect(result[1]).toEqual({ i: yesterday, value: 3 });
    expect(result[0].value).toBe(0);
  });

  it("supports alternate value keys (amount, count, c) and string numbers", () => {
    const today = moment().format("YYYY-MM-DD");
    expect(normalizeTimeSeries([{ date: today, count: 4 }], 1, "day")[0].value).toBe(4);
    expect(normalizeTimeSeries([{ date: today, amount: 7 }], 1, "day")[0].value).toBe(7);
    expect(normalizeTimeSeries([{ h: today, c: 2 }], 1, "day")[0].value).toBe(2);
    expect(normalizeTimeSeries([{ date: today, value: "12.5" }], 1, "day")[0].value).toBe(12.5);
  });

  it("uses the hourly format for hour units", () => {
    const result = normalizeTimeSeries([], 2, "hour");
    expect(result[1].i).toBe(moment().format("YYYY-MM-DDTHH"));
  });
});

describe("generateResourceId", () => {
  it("builds prefix + 4-char signature + entropy of the requested length", () => {
    const id = generateResourceId("sub", "org_123", 20);
    expect(id.startsWith("sub_")).toBe(true);
    expect(id).toHaveLength("sub_".length + 4 + 20);
  });

  it("derives a stable signature from the base signature", () => {
    const a = generateResourceId("wh", "org_123", 10);
    const b = generateResourceId("wh", "org_123", 10);
    expect(a.slice(0, 7)).toBe(b.slice(0, 7)); // "wh_" + 4 signature chars
  });

  it("rejects invalid arguments", () => {
    expect(() => generateResourceId("", "sig", 10)).toThrow();
    expect(() => generateResourceId("p", "", 10)).toThrow();
    expect(() => generateResourceId("p", "sig", 0)).toThrow();
  });
});

describe("maskData / unmaskData", () => {
  const encrypt = (v: string) => Buffer.from(v).toString("base64");
  const decrypt = (v: string) => Buffer.from(v, "base64").toString();

  it("masks sensitive keys and round-trips through unmask", () => {
    const masked = maskData({ apiKey: "secret", name: "ok" }, ["apiKey"], "enc::", encrypt);
    expect(masked.apiKey).toBe(`enc::${encrypt("secret")}`);
    expect(masked.name).toBe("ok");

    const unmasked = unmaskData(masked, "enc::", decrypt);
    expect(unmasked).toEqual({ apiKey: "secret", name: "ok" });
  });

  it("does not double-mask already masked values", () => {
    const once = maskData({ apiKey: "secret" }, ["apiKey"], "enc::", encrypt);
    const twice = maskData(once, ["apiKey"], "enc::", encrypt);
    expect(twice).toEqual(once);
  });

  it("recurses into nested objects and preserves arrays", () => {
    const masked = maskData({ nested: { token: "t" }, list: [{ token: "u" }] }, ["token"], "enc::", encrypt);
    expect(masked.nested.token).toBe(`enc::${encrypt("t")}`);
    expect(Array.isArray(masked.list)).toBe(true);
    expect(masked.list[0].token).toBe(`enc::${encrypt("u")}`);

    const unmasked = unmaskData(masked, "enc::", decrypt);
    expect(Array.isArray(unmasked.list)).toBe(true);
    expect(unmasked).toEqual({ nested: { token: "t" }, list: [{ token: "u" }] });
  });
});
