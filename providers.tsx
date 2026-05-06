"use client";

import * as React from "react";

import { AppModalProvider } from "@/components/app-modal";
import { initPostHog } from "@/lib/posthog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { GuidedFlowUI } from "./components/guided-flow-ui";
import { WalletProvider } from "./contexts/wallet-context";
import { useGuidedFlow } from "./hooks/use-guided-flow";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

const ONBOARDING_STEPS = [
  { id: "step_sidebar", path: "/", title: "Dashboard", content: "Access all your tools from here." },
  {
    id: "step_create",
    path: "/products",
    title: "Create Product",
    content: "Start by adding your first digital asset.",
  },
];

const PAYOUT_STEPS = [
  { id: "withdraw_btn", path: "/payout", title: "Cash Out", content: "Withdraw your XLM to your local bank account." },
];

export const Providers = ({ children }: { children: React.ReactNode }) => {
  React.useEffect(() => {
    initPostHog();
  }, []);

  const onboardingFlow = useGuidedFlow("onboarding_v1", ONBOARDING_STEPS);
  const payoutFlow = useGuidedFlow("payout_v1", PAYOUT_STEPS);

  return (
    <QueryClientProvider client={queryClient}>
      <AppModalProvider>
        <WalletProvider>{children}</WalletProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </AppModalProvider>
      <GuidedFlowUI flows={[onboardingFlow, payoutFlow]} />
    </QueryClientProvider>
  );
};

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
