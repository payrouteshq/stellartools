"use client";

import { Suspense, useEffect } from "react";

import { useStellarToolsContext } from "@stellartools/app-sdk";
import { useRouter, useSearchParams } from "next/navigation";

const AppRouter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useStellarToolsContext();

  useEffect(() => {
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    router.replace(settings?.resendApiKey ? `/dashboard${qs}` : `/authentication${qs}`);
  }, [settings, router, searchParams]);

  return null;
};

export default function Page() {
  return (
    <Suspense>
      <AppRouter />
    </Suspense>
  );
}

