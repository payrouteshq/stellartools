import type { AssetMetadata } from "@/db/schema";
import { getAssetUsdPrice, getFiatRates } from "@/integrations/price-feed";
import Big from "big.js";

const STELLAR_PRECISION = 7;

const toRawUnits = (decimalAmount: string): bigint =>
  BigInt(Math.round(Number(decimalAmount) * 10 ** STELLAR_PRECISION));

export const Money = {
  calculateCryptoNeeded: (usdCents: number, assetUsdPrice: number): string => {
    if (assetUsdPrice <= 0) return "0";
    return new Big(usdCents)
      .div(100)
      .div(assetUsdPrice)
      .toFixed(STELLAR_PRECISION)
      .replace(/\.?0+$/, "");
  },

  // cents → "15.6250000" suitable for Stellar operation amounts
  centsToStellarString: (cents: number): string => {
    return new Big(cents).div(100).toFixed(STELLAR_PRECISION);
  },

  addSlippage: (amount: string, percentage = 0.01): string => {
    return new Big(amount).times(1 + percentage).toFixed(STELLAR_PRECISION);
  },

  // cents → "₦15,000.00" in any locale
  formatFiat: (cents: number, currency = "USD", locale = "en-US"): string => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
    } catch {
      return `${new Intl.NumberFormat(locale).format(cents / 100)} ${currency}`;
    }
  },

  // Translate USD cents to local-currency cents using an exchange rate
  translateToLocal: (usdCents: number, rate: number): number => {
    return Math.round(new Big(usdCents).times(rate).toNumber());
  },

  // USD cents → local currency string (alias kept for explicit call sites)
  format: (cents: number, currency: string): string => {
    return Money.formatFiat(cents, currency);
  },

  // Decimal crypto amount → "5.1234567 XLM"
  formatCrypto: (amount: number | string, assetCode: string): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return (
      new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 7 }).format(num) +
      " " +
      assetCode.toUpperCase()
    );
  },

  /** Fiat product price → crypto amount using current rates (subscriptions). */
  calculateSubscriptionAmount: async (params: {
    priceCents: number;
    currencyCode: string;
    assetMetadata: AssetMetadata;
  }): Promise<{ cryptoAmount: string; amountRaw: bigint; usdCents: number }> => {
    const fiatRates = await getFiatRates();
    const fiatRate = fiatRates[params.currencyCode ?? "USD"] ?? 1;
    const usdCents = params.priceCents / fiatRate;
    const assetUsdPrice = await getAssetUsdPrice(params.assetMetadata);
    const cryptoAmount = Money.calculateCryptoNeeded(usdCents, assetUsdPrice);
    return { cryptoAmount, amountRaw: toRawUnits(cryptoAmount), usdCents };
  },
};
