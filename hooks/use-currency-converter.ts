"use client";

import * as React from "react";

import { useOrgContext } from "@/hooks/use-org-query";
import { Money } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";

interface CurrencyConverterOverrides {
  currency?: string;
  fiatRates?: Record<string, number>;
}

export function useCurrencyConverter(overrides?: CurrencyConverterOverrides) {
  const { data: org } = useOrgContext();
  const currency = overrides?.currency ?? org?.selectedCurrency ?? "USD";

  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["fiat-rates"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/fiat-rates`, {
        headers: { "x-session-token": org!.token },
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as { fiatRates: Record<string, number> };
    },
    enabled: !!org?.token && !overrides?.fiatRates,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const fiatRates = overrides?.fiatRates ?? ratesData?.fiatRates ?? null;

  const rate = React.useMemo(() => {
    if (currency === "USD") return 1;
    return fiatRates?.[currency] ?? 1;
  }, [fiatRates, currency]);

  const convertAndFormat = React.useCallback(
    (usdCents: number): string => {
      if (isLoading && !overrides?.fiatRates) return "—";
      return Money.formatFiat(Money.translateToLocal(usdCents, rate), currency);
    },
    [isLoading, rate, currency, overrides?.fiatRates]
  );

  const convertRaw = React.useCallback(
    (usdCents: number): number => Money.translateToLocal(usdCents, rate) / 100,
    [rate]
  );

  const convertToOrgCurrency = React.useCallback(
    (amountCents: number, fromCurrency: string): number => {
      if (!fiatRates) return amountCents;
      if (fromCurrency === currency) return amountCents;
      const rateFrom = fiatRates[fromCurrency] ?? 1;
      return Math.round((amountCents / rateFrom) * rate);
    },
    [fiatRates, currency, rate]
  );

  return { convertAndFormat, convertRaw, convertToOrgCurrency, fiatRates, isLoading, currency, rate };
}
