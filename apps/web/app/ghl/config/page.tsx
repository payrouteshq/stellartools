"use client";

import * as React from "react";

import { Badge, Button, TextField } from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

function ModeForm({ locationId, mode }: { locationId: string; mode: "test" | "live" }) {
  const [apiKey, setApiKey] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);

  const handleConnect = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ghl/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, mode, apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKey("");
        setConnected(true);
      } else {
        setError(data.error ?? "Could not connect.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium capitalize">{mode} mode</p>
        {connected && <Badge>Connected</Badge>}
      </div>
      <div className="flex gap-2">
        <TextField
          id={`${mode}-api-key`}
          label=""
          placeholder="StellarTools secret API key"
          value={apiKey}
          onChange={setApiKey}
          error={error}
          className="font-mono text-sm shadow-none"
        />
        <Button className="shadow-none" isLoading={pending} disabled={!apiKey} onClick={handleConnect}>
          Connect
        </Button>
      </div>
    </div>
  );
}

function ConfigForm() {
  const locationId = useSearchParams().get("locationId");

  if (!locationId) {
    return <p className="text-destructive p-6 text-sm">Missing locationId. Reopen this page from HighLevel.</p>;
  }

  return (
    <div className="bg-background min-h-screen px-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect StellarTools</h2>
          <p className="text-muted-foreground text-sm">
            Paste your StellarTools secret API keys. Test mode accepts testnet payments; live mode accepts real
            payments and requires a mainnet key.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <ModeForm locationId={locationId} mode="test" />
          <ModeForm locationId={locationId} mode="live" />
        </div>

        <p className="text-muted-foreground text-xs">
          Once a mode is connected, set StellarTools as the default provider from Payments &gt; Integrations in
          HighLevel to start accepting payments.
        </p>
      </section>
    </div>
  );
}

export default function GhlConfigPage() {
  return (
    <React.Suspense>
      <ConfigForm />
    </React.Suspense>
  );
}
