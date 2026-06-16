"use client";

import { ConnectStep } from "@/app/components/connect-step";
import { OverviewStep } from "@/app/components/overview-step";
import { ResendAppProvider, useResendApp } from "@/app/context/resend-app-context";
import Image from "next/image";

function ResendApp() {
  const { step, error } = useResendApp();

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-primary flex items-center justify-between px-5 py-4">
        <Image src="/resend-wordmark-black.png" alt="Resend" width={96} height={24} priority className="h-5 w-auto" />
      </header>

      <main className="px-5 pb-8">
        {error && <p className="text-destructive border-destructive/20 mt-4 border px-3 py-2 text-sm">{error}</p>}
        {step === "connect" ? <ConnectStep /> : <OverviewStep />}
      </main>
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
