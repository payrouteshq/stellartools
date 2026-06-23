"use client";

import * as React from "react";

import { resolveAppContext } from "@/app/actions/context";
import { type AppContext, StellarToolsAppProvider } from "@stellartools/app-sdk";
import { Skeleton } from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

const AppContextBridge = ({ children }: { children: React.ReactNode }) => {
  const searchParams = useSearchParams();
  const token = searchParams.get("st_token");

  const [context, setContext] = React.useState<AppContext | null>(null);

  React.useEffect(() => {
    if (!token) return;
    resolveAppContext(token).then(setContext);
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
