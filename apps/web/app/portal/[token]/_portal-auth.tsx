"use client";

import { useState, useTransition } from "react";

import { sendPortalOtp, verifyPortalOtp } from "@/actions/customers";
import { StellarToolsIcon } from "@/components/icon";
import { ModeToggle } from "@/components/mode-toggle";
import { useCookieState } from "@/hooks/use-cookie-state";
import { Button, InputOTP, InputOTPGroup, InputOTPSlot, Spinner } from "@stellartools/shared-ui";
import { useRouter } from "next/navigation";

type Org = { name: string; logoUrl: string | null } | null;

const OTP_STEP_COOKIE_TTL = new Date(Date.now() + 60 * 60 * 1000);

export function PortalAuthGate({ token, org }: { token: string; org: Org }) {
  const router = useRouter();
  const [otpStep, setOtpStep] = useCookieState<{ step: "idle" | "sent"; maskedEmail: string | null }>(
    `portal_otp_step_${token.slice(0, 20)}`,
    { step: "idle", maskedEmail: null },
    { expires: OTP_STEP_COOKIE_TTL, path: "/" }
  );
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
        setOtpStep({ step: "sent", maskedEmail: result.maskedEmail });
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
        setOtpStep({ step: "idle", maskedEmail: null });
        router.refresh();
      }
    });
  }

  const orgName = org?.name ?? "StellarTools";

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
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

      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm space-y-6 text-center">
            {otpStep.step === "idle" ? (
              <>
                <div>
                  <p className="text-foreground text-lg font-semibold">Verify your identity</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    We'll send a verification code to confirm you own this account.
                  </p>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button onClick={handleSend} disabled={isSending} className="w-full">
                  {isSending ? <Spinner className="size-4" /> : "Send verification code"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-foreground text-lg font-semibold">Enter your code</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    We sent a 6-digit code to{" "}
                    <span className="text-foreground font-medium">{otpStep.maskedEmail}</span>.
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
                    {isSending ? <Spinner className="size-4" /> : "Resend code"}
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
