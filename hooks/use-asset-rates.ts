"use client";

import * as React from "react";

import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgContext } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { useQueries } from "@tanstack/react-query";

export type AssetSpec = { code: string; issuer: string };

export type AssetRatesResult = {
  rateMap: Record<string, number>;
  fiatRates: Record<string, number> | null;
  selectedCurrency: string;
  isLoading: boolean;
  toLocal: (amount: number, assetCode: string) => number;
  formatLocal: (amount: number) => string;
};

export function useAssetRates(assets: AssetSpec[]): AssetRatesResult {
  const { data: org } = useOrgContext();
  const [selectedCurrency] = useCookieState("dashboard_currency", "USD");

  const queries = useQueries({
    queries: assets.map((asset) => ({
      queryKey: ["rates", asset.code, asset.issuer],
      queryFn: async () => {
        if (!org) throw new AppError("No organization found");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/rates?asset=${encodeURIComponent(asset.code)}&issuer=${encodeURIComponent(asset.issuer)}`,
          { headers: { "x-session-token": org.token } }
        );

        if (!response.ok) throw new AppError(await response.text());

        const data = (await response.json()) as { assetUsd: number; fiatRates: Record<string, number> };

        return { assetUsd: data.assetUsd, fiatRates: data.fiatRates, code: asset.code };
      },
      enabled: !!org?.token,
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
    })),
  });

  const rateMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of queries) {
      if (q.data) {
        map[q.data.code] = (q.data?.assetUsd ?? 1) * (q.data.fiatRates?.[selectedCurrency] ?? 1);
      }
    }
    return map;
  }, [queries, selectedCurrency]);

  const fiatRates = queries.find((q) => q.data)?.data?.fiatRates ?? null;
  const isLoading = queries.some((q) => q.isLoading);

  const toLocal = React.useCallback(
    (amount: number, assetCode: string) => amount * (rateMap[assetCode] ?? 1),
    [rateMap]
  );

  const formatLocal = React.useCallback(
    (amount: number) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: selectedCurrency,
          minimumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${selectedCurrency} ${amount.toFixed(2)}`;
      }
    },
    [selectedCurrency]
  );

  return { rateMap, fiatRates, selectedCurrency, isLoading, toLocal, formatLocal };
}
