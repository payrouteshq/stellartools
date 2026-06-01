"use client";

import * as React from "react";

import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { AppError, execute } from "@/lib/action-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout } from "../_shared";

const schema = z
  .object({
    newPassword: z.string().min(8, "Must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function UpdatePassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [showPass, setShowPass] = React.useState(false);

  const { error, setDismissedError } = useAuth();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirmPassword: "" } });

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) => {
      if (!token) throw new AppError("Invalid or expired token");
      return execute(resetPassword(token, data.newPassword));
    },
    onSuccess: () => {
      toast.success("Password updated!");
      router.push("/signin");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <AuthLayout
      title="Update password"
      subtitle="Choose a new password for your account."
      error={!token ? "Token missing. Please request a new link." : error}
      onDismissError={() => setDismissedError(true)}
      isPending={mutation.isPending}
      onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">New Password</Label>
          <Controller
            control={form.control}
            name="newPassword"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <InputGroup>
                  <InputGroupInput {...field} type={showPass ? "text" : "password"} placeholder="••••••••" />
                  <InputGroupAddon align="inline-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
              </div>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Confirm New Password</Label>
          <Controller
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <InputGroup>
                  <InputGroupInput {...field} type="password" placeholder="••••••••" />
                </InputGroup>
                {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
              </div>
            )}
          />
        </div>
      </div>

      <Button type="submit" className="w-full font-semibold" isLoading={mutation.isPending} disabled={!token}>
        Update password
      </Button>
    </AuthLayout>
  );
}
