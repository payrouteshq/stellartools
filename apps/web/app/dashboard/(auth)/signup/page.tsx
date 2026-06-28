"use client";

import * as React from "react";

import { accountValidator, completeGoogleSignup } from "@/actions/auth";
import { useAction } from "@/hooks/use-action";
import { useAuth } from "@/hooks/use-auth";
import { capture, identifyUser } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, InputGroup, InputGroupAddon, InputGroupInput, Label, TextField } from "@stellartools/shared-ui";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout } from "../_shared";

const signUpSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const [showPassword, setShowPassword] = React.useState(false);
  const { error, handleGoogleSignIn, setDismissedError } = useAuth();
  const searchParams = useSearchParams();

  const mode = searchParams?.get("mode");
  const isGoogleComplete = mode === "google-complete";
  const prefillEmail = searchParams?.get("email") ?? "";
  const prefillFirstName = searchParams?.get("firstName") ?? "";
  const prefillLastName = searchParams?.get("lastName") ?? "";
  const prefillName = [prefillFirstName, prefillLastName].filter(Boolean).join(" ");

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: prefillName || "",
      email: prefillEmail || "",
      password: "",
    },
  });

  const { mutate: signup, isPending: isSigning } = useAction(
    (data: SignUpFormData) => {
      const [firstName, ...lastNameParts] = data.name.split(" ");
      const lastName = lastNameParts.join(" ");

      return accountValidator(
        data.email,
        { provider: "local", sub: data.password },
        "SIGN_UP",
        { firstName, lastName, avatarUrl: undefined },
        { intent: "SIGN_UP" }
      );
    },
    {
      onSuccess: (_, variables) => {
        const [firstName, ...lastNameParts] = variables.name.split(" ");
        const lastName = lastNameParts.join(" ");
        identifyUser(variables.email, {
          email: variables.email,
          name: variables.name,
          firstName,
          lastName,
          authMethod: "local",
        });
        capture("user_signed_up", { email: variables.email, auth_method: "local" });
      },
      successMsg: "Account created successfully",
      errorMsg: "Failed to create account",
    }
  );

  const { mutate: completeGoogle, isPending: isCompletingGoogle } = useAction(
    (data: SignUpFormData) => completeGoogleSignup(data.email, data.password),
    {
      onSuccess: (_, variables) => {
        identifyUser(variables.email, {
          email: variables.email,
          name: variables.name,
          firstName: prefillFirstName,
          lastName: prefillLastName,
          authMethod: "google",
        });
        capture("user_signed_up", { email: variables.email, auth_method: "google" });
      },
      successMsg: "Account set up successfully",
      errorMsg: "Failed to set up account",
    }
  );

  const isPending = isSigning || isCompletingGoogle;

  const handleSubmit = form.handleSubmit((data) => {
    if (isGoogleComplete) {
      completeGoogle(data);
    } else {
      signup(data);
    }
  });

  return (
    <AuthLayout
      title={isGoogleComplete ? "Set your password" : "Get started"}
      subtitle={
        isGoogleComplete
          ? "Your Google account is linked. Set a password to also sign in with email."
          : "Create your StellarTools account"
      }
      error={error}
      onDismissError={() => setDismissedError(true)}
      isPending={isPending}
      googleConfig={isGoogleComplete ? undefined : { onClick: handleGoogleSignIn }}
      onSubmit={handleSubmit}
      alternateLink={
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link href="/signin" className="hover:text-foreground font-semibold underline transition-colors">
            Sign in
          </Link>
        </p>
      }
    >
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            id="name"
            label="Full Name"
            placeholder="John Doe"
            className="shadow-none"
            error={fieldState.error?.message}
            disabled={isGoogleComplete}
          />
        )}
      />

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
            disabled={isGoogleComplete}
          />
        )}
      />

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Password</Label>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <div className="space-y-1.5">
              <InputGroup className="dark:border-border w-full shadow-none">
                <InputGroupInput
                  {...field}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
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
        isLoading={isPending}
      >
        {isGoogleComplete ? "Continue" : "Sign up"}
      </Button>
    </AuthLayout>
  );
}
