import { Money } from "@/lib/money";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/price-feed", () => ({
  getFiatRates: vi.fn(async () => ({ USD: 1, NGN: 1500, EUR: 0.8 })),
  getAssetUsdPrice: vi.fn(async () => 0.5),
}));

describe("Money.convert (overview stats currency normalization)", () => {
  const rates = { USD: 1, NGN: 1500, EUR: 0.8 };

  it("returns the amount unchanged for same-currency", () => {
    expect(Money.convert(12345, "USD", "USD", rates)).toBe(12345);
    expect(Money.convert(500, "NGN", "NGN", rates)).toBe(500);
  });

  it("converts local currency into USD", () => {
    expect(Money.convert(150000, "NGN", "USD", rates)).toBe(100);
  });

  it("converts USD into a local currency", () => {
    expect(Money.convert(100, "USD", "NGN", rates)).toBe(150000);
  });

  it("converts across two non-USD currencies through USD", () => {
    // 800 EUR-cents -> 1000 USD-cents -> 1,500,000 NGN-cents
    expect(Money.convert(800, "EUR", "NGN", rates)).toBe(1500000);
  });

  it("falls back to a 1:1 USD rate for unknown currencies", () => {
    expect(Money.convert(100, "XXX", "USD", rates)).toBe(100);
    expect(Money.convert(100, "USD", "XXX", rates)).toBe(100);
  });

  it("rounds to whole cents", () => {
    expect(Money.convert(100, "USD", "EUR", rates)).toBe(80);
    expect(Money.convert(1, "NGN", "USD", rates)).toBe(0);
  });

  it("accepts string amounts (SQL sums) and rejects garbage", () => {
    expect(Money.convert("150000", "NGN", "USD", rates)).toBe(100);
    expect(Money.convert("not-a-number", "NGN", "USD", rates)).toBe(0);
  });
});

describe("Money.calculateCryptoNeeded", () => {
  it("converts USD cents to crypto units at the asset price", () => {
    expect(Money.calculateCryptoNeeded(1000, 2)).toBe("5");
  });

  it("keeps stellar precision and strips trailing zeros", () => {
    expect(Money.calculateCryptoNeeded(1000, 3)).toBe("3.3333333");
    expect(Money.calculateCryptoNeeded(100, 0.5)).toBe("2");
  });

  it("returns 0 when the asset price is zero or negative", () => {
    expect(Money.calculateCryptoNeeded(1000, 0)).toBe("0");
    expect(Money.calculateCryptoNeeded(1000, -1)).toBe("0");
  });
});

describe("Money formatting and precision helpers", () => {
  it("centsToStellarString renders 7-decimal amounts", () => {
    expect(Money.centsToStellarString(1563)).toBe("15.6300000");
    expect(Money.centsToStellarString(0)).toBe("0.0000000");
  });

  it("addSlippage applies the default 1%", () => {
    expect(Money.addSlippage("100")).toBe("101.0000000");
    expect(Money.addSlippage("100", 0.05)).toBe("105.0000000");
  });

  it("translateToLocal multiplies USD cents by the rate and rounds", () => {
    expect(Money.translateToLocal(100, 1500)).toBe(150000);
    expect(Money.translateToLocal(333, 0.5)).toBe(167);
  });

  it("formatFiat renders known currencies and falls back for unknown codes", () => {
    expect(Money.formatFiat(123456, "USD")).toBe("$1,234.56");
    expect(Money.formatFiat(1234, "NOTACURRENCY")).toBe("12.34 NOTACURRENCY");
  });

  it("formatCrypto uppercases the asset code", () => {
    expect(Money.formatCrypto("5.1234567", "xlm")).toBe("5.1234567 XLM");
  });
});

describe("Money.calculateSubscriptionAmount", () => {
  it("converts a local-fiat product price to crypto via USD", async () => {
    // 150,000 NGN-cents / 1500 = 100 USD-cents = $1; at $0.50/unit -> 2 units
    const result = await Money.calculateSubscriptionAmount({
      priceCents: 150000,
      currencyCode: "NGN",
      assetMetadata: {} as never,
    });

    expect(result.usdCents).toBe(100);
    expect(result.cryptoAmount).toBe("2");
    expect(result.amountRaw).toBe(BigInt(20000000));
  });

  it("treats USD products as 1:1", async () => {
    const result = await Money.calculateSubscriptionAmount({
      priceCents: 1000,
      currencyCode: "USD",
      assetMetadata: {} as never,
    });

    expect(result.usdCents).toBe(1000);
    expect(result.cryptoAmount).toBe("20");
    expect(result.amountRaw).toBe(BigInt(200000000));
  });
});
