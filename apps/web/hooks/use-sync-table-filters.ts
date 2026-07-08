"use client";

import * as React from "react";

import { ColumnFiltersState } from "@tanstack/react-table";
import _ from "lodash";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useSyncTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingFilters, setPendingFilters] = React.useState<ColumnFiltersState | null>(null);

  const urlFilters = React.useMemo(() => {
    const raw = searchParams.get("filter");
    if (!raw) return [] as ColumnFiltersState;
    try {
      const decoded = JSON.parse(raw);
      return decoded.map((f: { field: string; value: unknown; type?: string }) => ({
        id: f.field,
        value: f.value,
        type: f.type,
      }));
    } catch {
      return [] as ColumnFiltersState;
    }
  }, [searchParams]);

  React.useEffect(() => {
    setPendingFilters(null);
  }, [searchParams]);

  const filters = pendingFilters ?? urlFilters;

  const setFilters = React.useCallback(
    (updaterOrValue: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const nextValue = typeof updaterOrValue === "function" ? updaterOrValue(filters) : updaterOrValue;

      if (_.isEqual(filters, nextValue)) return;

      setPendingFilters(nextValue);

      const urlFilters = nextValue.map((f) => ({
        field: f.id,
        value: f.value,
        type: (f as { type?: string }).type || "con",
      }));

      const params = new URLSearchParams(searchParams.toString());
      if (urlFilters.length > 0) {
        params.set("filter", JSON.stringify(urlFilters));
      } else {
        params.delete("filter");
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [filters, pathname, router, searchParams]
  );

  return [filters, setFilters] as const;
}
