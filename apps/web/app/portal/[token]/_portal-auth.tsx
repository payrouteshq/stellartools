"use client";

import { useState, useTransition } from "react";

import { sendPortalOtp, verifyPortalOtp } from "@/actions/customers";
import { StellarToolsIcon } from "@/components/icon";
import { ModeToggle } from "@/components/mode-toggle";
import { Button, InputOTP, InputOTPGroup, InputOTPSlot } from "@stellartools/shared-ui";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Org = { name: string; logoUrl: string | null } | null;

export function PortalAuthGate({ token, org }: { token: string; org: Org }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSend] = useTransition();
  const [isVerifying, startVerify] = useTransition();

  function handleSend() {
    startSend(async () => {
      const result = await sendPortalOtp(token);
      if ("error" in result) {
        setError(result.error);
      } else {
        setMaskedEmail(result.maskedEmail);
        setStep("sent");
        setError(null);
      }
    });
  }

  function handleVerify(val: string) {
    startVerify(async () => {
      const result = await verifyPortalOtp(token, val);
      if ("error" in result) {
        setError(result.error);
        setCode("");
      } else {
        router.refresh();
      }
    });
  }

  const orgName = org?.name ?? "StellarTools";

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border bg-background hidden w-[280px] shrink-0 flex-col border-r px-8 py-10 md:flex!">
        <div className="mb-6 flex items-center gap-3">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={orgName} className="size-8 rounded-md object-contain" />
          ) : (
            <Building2 className="text-foreground size-8" />
          )}
          <span className="text-foreground truncate text-sm font-semibold">{orgName}</span>
        </div>
        <div className="mt-auto flex justify-end">
          <ModeToggle />
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-border flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={orgName} className="size-7 rounded-md object-contain" />
            ) : (
              <StellarToolsIcon width={24} height={24} className="shrink-0 object-contain" />
            )}
            <span className="text-foreground text-sm font-semibold">{orgName}</span>
          </div>
          <ModeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm space-y-6 text-center">
            {step === "idle" ? (
              <>
                <div>
                  <p className="text-foreground text-lg font-semibold">Verify your identity</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    We'll send a verification code to confirm you own this account.
                  </p>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button onClick={handleSend} disabled={isSending} className="w-full">
                  {isSending ? "Sending…" : "Send verification code"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-foreground text-lg font-semibold">Enter your code</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    We sent a 6-digit code to <span className="text-foreground font-medium">{maskedEmail}</span>.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    onComplete={handleVerify}
                    disabled={isVerifying}
                  >
                    <InputOTPGroup>
                      {[...Array(6)].map((_, i) => (
                        <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                </div>
                <p className="text-muted-foreground text-sm">
                  Didn't receive it?{" "}
                  <button
                    className="text-foreground font-medium hover:underline disabled:opacity-50"
                    onClick={() => {
                      setCode("");
                      setError(null);
                      handleSend();
                    }}
                    disabled={isSending}
                  >
                    {isSending ? "Sending…" : "Resend code"}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
