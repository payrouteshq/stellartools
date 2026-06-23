"use client";

import * as React from "react";

import { type AppContext, StellarToolsAppProvider, parseAppContext } from "@stellartools/app-sdk";
import { Skeleton } from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

const AppContextBridge = ({ children }: { children: React.ReactNode }) => {
  const searchParams = useSearchParams();
  const token = searchParams.get("st_token");

  const context = React.useMemo((): AppContext | null => {
    if (!token) return null;
    return parseAppContext(token, process.env.RESEND_APP_SECRET!);
  }, [token]);

  React.useEffect(() => {
    if (!context) return;
    document.documentElement.classList.toggle("dark", context.ui.theme === "dark");
  }, [context]);

  if (!context) return null;

  return <StellarToolsAppProvider context={context}>{children}</StellarToolsAppProvider>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <AppContextBridge>{children}</AppContextBridge>
    </React.Suspense>
  );
}
