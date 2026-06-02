"use client";

import * as React from "react";

import { completeTwoFactorSignIn } from "@/actions/2fa";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/components/ui/toast";
import { execute } from "@/lib/action-handler";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthLayout } from "../_shared";

const REGEXP_ONLY_DIGITS = "^[0-9]+$";

export default function TwoFactorPage() {
  const [code, setCode] = React.useState("");
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => execute(completeTwoFactorSignIn(otp)),
    onSuccess: () => {
      window.location.href = next ?? "/";
    },
    onError: (err: any) => toast.error(err.message || "Verification failed"),
  });

  const handleComplete = (value: string) => {
    setCode(value);
    verifyMutation.mutate(value);
  };

  return (
    <AuthLayout
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app"
      onDismissError={() => {}}
      isPending={verifyMutation.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) verifyMutation.mutate(code);
      }}
    >
      <div className="flex flex-col items-center gap-6 py-2">
        <InputOTP
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={setCode}
          onComplete={handleComplete}
          disabled={verifyMutation.isPending}
          autoFocus
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
            <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
            <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
            <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
            <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
            <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
          </InputOTPGroup>
        </InputOTP>

        <Button
          type="submit"
          className="w-full rounded-md font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
          isLoading={verifyMutation.isPending}
          disabled={code.length !== 6 || verifyMutation.isPending}
        >
          Verify
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/signin" className="hover:text-foreground font-semibold underline transition-colors">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
