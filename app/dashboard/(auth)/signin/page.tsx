"use client";

import * as React from "react";

import { accountValidator } from "@/actions/auth";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { capture, identifyUser } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout } from "../_shared";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function SignIn() {
  const [showPassword, setShowPassword] = React.useState(false);
  const { error, handleGoogleSignIn, setDismissedError } = useAuth();

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signinMutation = useMutation({
    mutationFn: (data: SignInFormData) =>
      accountValidator(data.email, { provider: "local", sub: data.password }, "SIGN_IN", undefined, {
        intent: "SIGN_IN",
      }),
    onSuccess: (_data, variables) => {
      identifyUser(variables.email, { email: variables.email, authMethod: "local" });
      capture("user_signed_in", { email: variables.email, auth_method: "local" });
      toast.success("Logged in successfully");
      window.location.href = "/";
    },
    onError: (err: any) => toast.error(err.message || "Sign-in failed"),
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your StellarTools account"
      error={error}
      onDismissError={() => setDismissedError(true)}
      isPending={signinMutation.isPending}
      googleConfig={{ onClick: handleGoogleSignIn }}
      onSubmit={form.handleSubmit((d) => signinMutation.mutate(d))}
      alternateLink={
        <p className="text-muted-foreground text-sm">
          Don’t have an account?{" "}
          <Link href="/signup" className="hover:text-foreground font-semibold underline transition-colors">
            Sign up
          </Link>
        </p>
      }
    >
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            id="email"
            label="Email"
            placeholder="name@example.com"
            className="shadow-none"
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Password</Label>
          <Link
            href="/forgot-password"
            className="hover:text-foreground text-sm font-semibold underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <div className="space-y-1.5">
              <InputGroup className="dark:border-border w-full shadow-none">
                <InputGroupInput
                  {...field}
                  type={showPassword ? "text" : "password"}
                  placeholder={"•".repeat(8)}
                  aria-invalid={!!fieldState.error}
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shadow-none hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <Eye className="text-muted-foreground h-4 w-4" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
            </div>
          )}
        />
      </div>

      <Button
        type="submit"
        className="w-full rounded-md font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
        isLoading={signinMutation.isPending}
      >
        Sign in
      </Button>
    </AuthLayout>
  );
}
