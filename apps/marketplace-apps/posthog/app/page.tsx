"use client";

import * as React from "react";

import { useStellarToolsContext } from "@stellartools/app-sdk";
import { useRouter, useSearchParams } from "next/navigation";

const AppRouter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useStellarToolsContext();

  React.useEffect(() => {
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    router.replace(settings?.posthogProjectToken ? `/dashboard${qs}` : `/authentication${qs}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default function Page() {
  return (
    <React.Suspense>
      <AppRouter />
    </React.Suspense>
  );
}
