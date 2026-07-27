"use client";

import * as React from "react";

import { Button, TextField } from "@stellartools/shared-ui";

/**
 * @description
 * Faithful static reproduction of `apps/marketplace-apps/loops/app/authentication/page.tsx`
 */
export function LoopsAppPanel() {
  const [apiKey, setApiKey] = React.useState("");
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleConnect = () => {
    setApiKeyError(null);
    if (!apiKey) {
      setApiKeyError("API key is required");
      return;
    }

    setPending(true);
    setTimeout(() => setPending(false), 700);
  };

  return (
    <div className="px-1 pb-2">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-4">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect your account</h2>
          <p className="text-muted-foreground text-sm">Add your Loops API key to start sending lifecycle emails.</p>
        </div>

        <div className="flex flex-col gap-6">
          <TextField
            id="loops-api-key"
            label="API key"
            placeholder="Enter your Loops API key"
            value={apiKey}
            onChange={setApiKey}
            error={apiKeyError}
            className="font-mono text-sm shadow-none"
          />

          <Button className="w-full shadow-none" isLoading={pending} onClick={handleConnect}>
            {pending ? "Verifying…" : "Connect"}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Find your API key in{" "}
          <a
            href="https://app.loops.so/settings?page=api"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Loops → Settings → API
          </a>
          .
        </p>
      </section>
    </div>
  );
}
