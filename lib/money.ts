import Big from "big.js";

// Stellar handles 7 decimal places
const STELLAR_PRECISION = 7;

export const Money = {
  /**
   * 1000 cents ($10.00) -> "10.0000000"
   */
  centsToStellarString: (cents: number): string => {
    return new Big(cents).div(100).toFixed(STELLAR_PRECISION);
  },

  /**
   * Calculates how much of a specific crypto is needed to cover a USD cent amount
   * Example: 1000 cents ($10) / 0.12 (XLM price) = 83.3333333
   */
  calculateCryptoNeeded: (usdCents: number, assetUsdPrice: number): string => {
    if (assetUsdPrice <= 0) return "0.0000000";
    return new Big(usdCents).div(100).div(assetUsdPrice).toFixed(STELLAR_PRECISION);
  },

  /**
   * Adds a slippage buffer for Path Payments.
   * If a user needs to spend XLM to buy USDC, we ask for 1% more max
   * to ensure the tx doesn't fail if the price moves slightly.
   */
  addSlippage: (amount: string, percentage = 0.01): string => {
    return new Big(amount).times(1 + percentage).toFixed(STELLAR_PRECISION);
  },

  /**
   * Format cents for UI display
   * 150000 cents -> "₦15,000.00"
   */
  formatFiat: (cents: number, currency = "USD", locale = "en-US"): string => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  },
};
