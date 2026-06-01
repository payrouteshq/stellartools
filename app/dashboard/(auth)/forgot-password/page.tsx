"use client";

import * as React from "react";

import { forgotPassword } from "@/actions/auth";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { execute } from "@/lib/action-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout } from "../_shared";

const schema = z.object({ email: z.email() });

export default function ForgotPassword() {
  const { error, setDismissedError } = useAuth();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const mutation = useMutation({
    mutationFn: (email: string) => execute(forgotPassword(email)),
    onSuccess: () => toast.success("Reset link sent to your email"),
    onError: () => toast.error("Failed to send reset link"),
  });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link."
      error={error}
      onDismissError={() => setDismissedError(true)}
      isPending={mutation.isPending}
      onSubmit={form.handleSubmit((d) => mutation.mutate(d.email))}
      alternateLink={
        <p className="text-muted-foreground text-sm">
          Remember your password?{" "}
          <Link href="/signin" className="hover:text-foreground font-semibold underline">
            Sign in
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
            error={fieldState.error?.message}
          />
        )}
      />
      <Button type="submit" className="w-full font-semibold" isLoading={mutation.isPending}>
        Send reset link
      </Button>
    </AuthLayout>
  );
}
