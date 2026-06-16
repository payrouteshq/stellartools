"use client";

import React from "react";

import { useResendApp } from "@/app/context/resend-app-context";
import { Button, Input, Label } from "@stellartools/shared-ui";

export function ConnectStep() {
  const { hasApiKey, resendApiKey, setResendApiKey, saving, saveConnectStep } = useResendApp();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Connect your account</h2>
        <p className="text-muted-foreground text-sm">Add your Resend API key to start sending emails.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="api-key" className="text-xs font-medium">
          API key
        </Label>
        <Input
          id="api-key"
          placeholder={hasApiKey ? "Saved — enter to replace" : "re_..."}
          value={resendApiKey}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResendApiKey(e.target.value)}
          className="shadow-none"
        />
      </div>

      <Button className="w-full shadow-none" disabled={saving} onClick={() => void saveConnectStep()}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </section>
  );
}
