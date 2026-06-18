"use client";

import { ConnectStep } from "@/app/components/connect-step";
import { OverviewStep } from "@/app/components/overview-step";
import { ResendAppProvider, useResendApp } from "@/app/context/resend-app-context";

function ResendApp() {
  const { step, error } = useResendApp();

  return (
    <div className="bg-background min-h-screen px-5 pb-8">
      {error && <p className="text-destructive border-destructive/20 mt-4 border px-3 py-2 text-sm">{error}</p>}
      {step === "connect" ? <ConnectStep /> : <OverviewStep />}
    </div>
  );
}

export default function Page() {
  return (
    <ResendAppProvider>
      <ResendApp />
    </ResendAppProvider>
  );
}
