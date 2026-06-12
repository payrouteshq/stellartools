import type { AssetMetadata } from "@/db/schema";
import { createCache } from "@/lib/cache";

const priceCache = createCache<number>();
const fiatCache = createCache<Record<string, number>>();

const PRICE_TTL = 1 * 60 * 1000; // 1 min
const FIAT_TTL = 2 * 60 * 1000; // 2 min

const fetchCoinGeckoPrice = async (geckoId: string): Promise<number> => {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data[geckoId]?.usd ?? 0;
  } catch {
    return 0;
  }
};

const fetchFiatRatesFromApi = async (): Promise<Record<string, number>> => {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return (data.rates as Record<string, number>) ?? {};
  } catch {
    return {};
  }
};

/**
 * --- Public Functional API ---
 */

export const getFiatRates = async (): Promise<Record<string, number>> => {
  const cached = fiatCache.get("rates");
  if (cached !== undefined) return cached;

  const rates = await fetchFiatRatesFromApi();
  fiatCache.set("rates", rates, FIAT_TTL);
  return rates;
};

export const getAssetUsdPrice = async (metadata: AssetMetadata): Promise<number> => {
  // 1. Hard Peg
  if (metadata.usdPeg) return 1;

  // 2. Fiat Peg (e.g. EURC)
  if (metadata.fiatPeg) {
    const rates = await getFiatRates();
    const rate = rates[metadata.fiatPeg];
    return rate ? 1 / rate : 0;
  }

  // 3. Dynamic Crypto Price (CoinGecko)
  if (metadata.coingeckoId) {
    const id = metadata.coingeckoId;
    const cached = priceCache.get(id);
    if (cached !== undefined) return cached;

    const price = await fetchCoinGeckoPrice(id);
    priceCache.set(id, price, PRICE_TTL);
    return price;
  }

  return 0;
};
