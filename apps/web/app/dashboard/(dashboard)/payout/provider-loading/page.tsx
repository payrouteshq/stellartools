import { Logo } from "@/components/logo";
import { LoaderCircle, ShieldCheck } from "lucide-react";

export default function PayoutProviderLoadingPage() {
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-10 flex justify-center">
          <Logo width={160} height={32} className="h-8 w-auto" priority />
        </div>

        <div className="border-border bg-card mx-auto flex size-16 items-center justify-center rounded-full border shadow-sm">
          <LoaderCircle className="text-primary size-7 animate-spin" />
        </div>

        <h1 className="mt-6 text-xl font-semibold">Preparing your payout</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Setting up a secure session with the payout partner. This window will continue automatically.
        </p>

        <div className="text-muted-foreground mt-8 flex items-center justify-center gap-2 text-xs">
          <ShieldCheck className="size-4" />
          Secure provider handoff
        </div>
      </div>
    </main>
  );
}
