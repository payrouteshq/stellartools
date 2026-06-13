"use client";

import * as React from "react";

import { ColumnFiltersState } from "@tanstack/react-table";
import _ from "lodash";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useSyncTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = React.useMemo(() => {
    const raw = searchParams.get("filter");
    if (!raw) return [] as ColumnFiltersState;
    try {
      const decoded = JSON.parse(raw);
      return decoded.map((f: any) => ({ id: f.field, value: f.value, type: f.type }));
    } catch (e) {
      return [] as ColumnFiltersState;
    }
  }, [searchParams]);

  const setFilters = React.useCallback(
    (updaterOrValue: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const nextValue = typeof updaterOrValue === "function" ? updaterOrValue(filters) : updaterOrValue;

      if (_.isEqual(filters, nextValue)) return;

      const urlFilters = nextValue.map((f) => ({
        field: f.id,
        value: f.value,
        type: (f as any).type || "con", // Default to "contains"
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
