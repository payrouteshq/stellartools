"use client";

import * as React from "react";

import { initPostHog } from "@/lib/posthog";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initPostHog();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  );
}
