"use client";

import { complete2fa } from "@/actions/2fa";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAction } from "@/hooks/use-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { z as Schema } from "@stellartools/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as RHF from "react-hook-form";

import { AuthLayout } from "../_shared";

const formSchema = Schema.object({
  code: Schema.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});

export default function TwoFactorPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const form = RHF.useForm<Schema.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "" },
  });

  const { mutate: verify, isPending: isVerifying } = useAction(complete2fa, {
    invalidate: ["current-user"],
    successMsg: "Verification successful",
    errorMsg: "Verification failed",
    onSuccess: () => {
      window.location.href = next ?? "/";
    },
  });

  return (
    <AuthLayout
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app"
      onDismissError={() => {}}
      isPending={isVerifying}
      onSubmit={form.handleSubmit((d) => verify(d.code))}
    >
      <form className="flex flex-col items-center gap-6" onSubmit={form.handleSubmit((d) => verify(d.code))}>
        <RHF.Controller
          control={form.control}
          name="code"
          render={({ field, fieldState }) => (
            <div className="flex flex-col items-center gap-6">
              <InputOTP
                maxLength={6}
                value={field.value}
                onChange={field.onChange}
                onComplete={() => {
                  form.handleSubmit((d) => verify(d.code))();
                }}
                disabled={isVerifying || form.formState.isSubmitting}
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-14 text-xl" />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {fieldState.error && <p className="text-destructive text-sm">{fieldState.error?.message}</p>}
            </div>
          )}
        />
      </form>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/signin" className="hover:text-foreground font-semibold underline transition-colors">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
