"use client";

import * as React from "react";
import { Suspense } from "react";

import { listResendDomains, validateApiKeyAndConnect } from "@/app/actions/resend";
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";

function AuthenticationForm() {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token");

  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [apiKey, setApiKey] = React.useState("");
  const [apiKeyError, setApiKeyError] = React.useState<string | null>(null);
  const [domains, setDomains] = React.useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = React.useState("");
  const [fromPrefix, setFromPrefix] = React.useState("noreply");
  const [pending, setPending] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const handleStep1 = async () => {
    setApiKeyError(null);
    if (!apiKey) {
      setApiKeyError("API key is required");
      return;
    }
    if (!/^re_/.test(apiKey)) {
      setApiKeyError("API key must start with re_");
      return;
    }

    setPending(true);
    try {
      const d = await listResendDomains(apiKey);
      setDomains(d);
      setSelectedDomain(d[0] ?? "");
      setStep(2);
    } catch (e) {
      setApiKeyError(e instanceof Error ? e.message : "Invalid API key");
    } finally {
      setPending(false);
    }
  };

  const handleStep2 = async () => {
    setServerError(null);
    if (!appToken) {
      setServerError("App token not found");
      return;
    }

    setPending(true);
    try {
      const fromEmail = domains.length > 0 && selectedDomain ? `${fromPrefix}@${selectedDomain}` : undefined;

      const result = await validateApiKeyAndConnect(apiKey, appToken, { fromEmail });
      if (result !== true) {
        setServerError(result);
        return;
      }

      window.parent.postMessage({ type: "stellar:data-changed" }, "*");
      router.push(`/dashboard?st_token=${appToken}`);
    } finally {
      setPending(false);
    }
  };

  if (step === 2) {
    return (
      <div className="bg-background min-h-screen px-5">
        <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Choose a sending domain</h2>
            <p className="text-muted-foreground text-sm">Set the address your emails will be sent from.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">From email</p>
            {domains.length > 0 ? (
              <InputGroup>
                <InputGroupInput
                  value={fromPrefix}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromPrefix(e.target.value)}
                  placeholder="noreply"
                  className="text-sm"
                />
                <InputGroupAddon align="inline-end">
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="h-auto border-0 px-0 shadow-none focus-visible:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d} value={d}>
                          @{d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </InputGroupAddon>
              </InputGroup>
            ) : (
              <>
                <InputGroup className="pointer-events-none opacity-60">
                  <InputGroupInput value="onboarding@resend.dev" readOnly className="text-sm" />
                </InputGroup>
                <p className="text-muted-foreground text-xs">
                  This address can only send to addresses registered in your Resend account.{" "}
                  <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">
                    Verify a sending domain
                  </a>{" "}
                  on Resend to email anyone.
                </p>
              </>
            )}
          </div>

          {serverError && (
            <p className="text-destructive text-sm" role="alert">
              {serverError}
            </p>
          )}

          <Button className="w-full shadow-none" isLoading={pending} onClick={handleStep2}>
            {pending ? "Connecting…" : "Connect"}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen px-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect your account</h2>
          <p className="text-muted-foreground text-sm">Add your Resend API key to start sending emails.</p>
        </div>

        <div className="flex flex-col gap-6">
          <TextField
            id="api-key"
            label="API key"
            placeholder="re_..."
            value={apiKey}
            onChange={setApiKey}
            error={apiKeyError}
            className="font-mono text-sm shadow-none"
          />

          <Button className="w-full shadow-none" isLoading={pending} onClick={handleStep1}>
            {pending ? "Verifying…" : "Continue"}
          </Button>
        </div>
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
