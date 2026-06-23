"use client";

import { createContext, useContext, useMemo } from "react";

import {
  QueryClient,
  QueryClientProvider,
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { AppContext } from "./types";

const StellarToolsContext = createContext<AppContext | null>(null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function StellarToolsAppProvider({ context, children }: { context: AppContext; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StellarToolsContext.Provider value={context}>{children}</StellarToolsContext.Provider>
    </QueryClientProvider>
  );
}

export function useStellarToolsContext() {
  const ctx = useContext(StellarToolsContext);

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
  const queryKey = useMemo(() => [...key, context.orgId, context.env, context.ui.periodDays], [key, context]);

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
