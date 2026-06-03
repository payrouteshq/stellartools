"use client";

import * as React from "react";

import { accountValidator } from "@/actions/auth";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { useAuth } from "@/hooks/use-auth";
import { capture, identifyUser } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
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

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
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

  return (
    <AuthLayout
      title="Get started"
      subtitle="Create your StellarTools account"
      error={error}
      onDismissError={() => setDismissedError(true)}
      isPending={isSigning}
      googleConfig={{ onClick: handleGoogleSignIn }}
      onSubmit={form.handleSubmit((d) => signup(d))}
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
        isLoading={isSigning}
      >
        Sign up
      </Button>
    </AuthLayout>
  );
}
