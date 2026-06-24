"use client";

import * as React from "react";

import {
  QueryClient,
  QueryClientProvider,
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { AppContext } from "./types";

const StellarToolsContext = React.createContext<AppContext | null>(null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap";

export function StellarToolsAppProvider({ context, children }: { context: AppContext; children: React.ReactNode }) {
  React.useEffect(() => {
    if (document.querySelector("[data-stellar-font]")) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_STYLESHEET;
    link.dataset.stellarFont = "true";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.dataset.stellarFont = "true";
    style.textContent = "html,body{font-family:'DM Sans',sans-serif}";
    document.head.appendChild(style);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StellarToolsContext.Provider value={context}>{children}</StellarToolsContext.Provider>
    </QueryClientProvider>
  );
}

export function useStellarToolsContext() {
  const ctx = React.useContext(StellarToolsContext);

  if (!ctx) throw new Error("useStellarToolsContext must be used within StellarToolsAppProvider");

  return ctx;
}

export function useStellarToolsQuery<T>(
  key: string[],
  fetcher: (context: AppContext) => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  const context = useStellarToolsContext();

  // We automatically add orgId and env to the key so that
  // switching organizations in the dashboard clears the app cache.
  const queryKey = React.useMemo(() => [...key, context.orgId, context.env, context.ui.periodDays], [key, context]);

  return useQuery({
    queryKey,
    queryFn: () => fetcher(context),
    ...options,
  });
}

export function useStellarToolsMutation<TArgs, TResult>(
  mutationFn: (args: TArgs, context: AppContext) => Promise<TResult>,
  options?: UseMutationOptions<TResult, Error, TArgs>
) {
  const context = useStellarToolsContext();

  return useMutation({
    ...options,
    mutationFn: (args: TArgs) => mutationFn(args, context),
    onSuccess: (data, variables, onMutateResult, mutationContext) => {
      // The SDK ApiClient already sent the 'stellar:data-changed' message,
      // so the parent dashboard is already refreshing!
      options?.onSuccess?.(data, variables, onMutateResult, mutationContext);
    },
    onError: (err, variables, onMutateResult, mutationContext) => {
      options?.onError?.(err, variables, onMutateResult, mutationContext);
    },
  });
}
