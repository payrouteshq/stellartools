"use client";

import * as React from "react";

import { AppModalProvider } from "@/components/app-modal";
import { initPostHog } from "@/lib/posthog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { WalletProvider } from "./contexts/wallet-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

export const Providers = ({ children }: { children: React.ReactNode }) => {
  React.useEffect(() => {
    initPostHog();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppModalProvider>
        <WalletProvider>{children}</WalletProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </AppModalProvider>
    </QueryClientProvider>
  );
};

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
