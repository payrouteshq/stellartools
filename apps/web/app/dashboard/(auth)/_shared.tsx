"use client";

import React from "react";

import { Google } from "@/components/icon";
import { StellarTools } from "@/components/icon";
import { Button, Separator } from "@stellartools/shared-ui";
import { AlertCircle, X } from "lucide-react";
import Link from "next/link";

export const AuthErrorAlert = ({ error, onDismissError }: { error?: string | null; onDismissError: () => void }) => {
  if (!error) return null;

  return (
    <div className="border-destructive/50 bg-destructive/10 flex w-full items-center rounded-lg border py-2">
      <div className="flex w-full items-center justify-between px-2">
        <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
        <p className="text-destructive ml-2 flex-1 text-sm font-semibold">{error}</p>

        <button
          onClick={onDismissError}
          className="text-destructive/70 hover:text-destructive shrink-0 cursor-pointer transition-colors hover:bg-transparent"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  error?: string | null;
  onDismissError: () => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  alternateLink?: React.ReactNode;
  googleConfig?: {
    onClick: () => void;
    label?: string;
  };
}

export function AuthLayout({
  title,
  subtitle,
  error,
  onDismissError,
  isPending,
  onSubmit,
  children,
  alternateLink,
  googleConfig,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="bg-foreground hidden flex-col justify-between overflow-hidden p-16 lg:flex!">
        <div className="space-y-8">
          <StellarTools width={100} height={100} className="text-background" />
          <h1 className="text-background mb-6 text-4xl leading-[1.1] font-extrabold tracking-normal">
            The financial infrastructure
            <br />
            for the
            <span className="text-primary ml-2">Stellar economy.</span>
          </h1>
          <div className="text-background/70 max-w-xs text-sm">
            Accept payments, manage subscriptions, and withdraw to local currency, all on the Stellar network.
          </div>
        </div>
        <p className="text-background/70 text-sm">
          © {new Date().getFullYear()} StellarTools ·{" "}
          <Link href="/terms" className="underline hover:opacity-80">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline hover:opacity-80">
            Privacy
          </Link>
        </p>
      </div>

      <div className="bg-background relative flex flex-col justify-center">
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-6 py-12">
          <div className="mb-6 w-full space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>

          <AuthErrorAlert error={error} onDismissError={onDismissError} />

          {googleConfig && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={googleConfig.onClick}
                className="hover:bg-muted mt-4 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-10 py-2.5 shadow-none transition-colors"
                disabled={isPending}
              >
                <Google className="h-5 w-5" />
                <span className="text-foreground text-sm font-semibold">
                  {googleConfig.label || "Continue with Google"}
                </span>
              </Button>

              <div className="my-6 flex w-full items-center">
                <Separator className="flex-1" />
                <span className="text-muted-foreground px-4 text-sm whitespace-nowrap">or continue with email</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className="w-full space-y-4">
            {children}
            {alternateLink && <div className="w-full pt-4 text-center">{alternateLink}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
