"use client";

import * as React from "react";
import { Suspense } from "react";

import { validateApiKeyAndConnect } from "@/app/actions/loops";
import { Button, TextField } from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";

function AuthenticationForm() {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token");
  const router = useRouter();

  const [apiKey, setApiKey] = React.useState("");
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleConnect = async () => {
    setApiKeyError(null);
    if (!apiKey) {
      setApiKeyError("API key is required");
      return;
    }
    if (!appToken) {
      setApiKeyError("App token not found");
      return;
    }

    setPending(true);
    try {
      const result = await validateApiKeyAndConnect(apiKey, appToken);
      if (result !== true) {
        setApiKeyError(result);
        return;
      }
      window.parent.postMessage({ type: "stellar:data-changed" }, "*");
      router.push(`/dashboard?st_token=${appToken}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-background min-h-screen px-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect your account</h2>
          <p className="text-muted-foreground text-sm">Add your Loops API key to start sending lifecycle emails.</p>
        </div>

        <div className="flex flex-col gap-6">
          <TextField
            id="api-key"
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

export default function AuthenticationPage() {
  return (
    <Suspense>
      <AuthenticationForm />
    </Suspense>
  );
}
