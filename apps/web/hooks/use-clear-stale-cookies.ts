"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const useClearStaleCookies = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clearKeys = searchParams?.get("clearKeys");

  React.useEffect(() => {
    if (!clearKeys) return;

    fetch(`/~api/clear-session?keys=${encodeURIComponent(clearKeys)}`).finally(() => {
      const newParams = new URLSearchParams(searchParams?.toString());
      newParams.delete("clearKeys");
      router.replace(`${pathname}${newParams.toString() ? `?${newParams.toString()}` : ""}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearKeys]);
};
