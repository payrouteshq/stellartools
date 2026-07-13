"use client";

import * as React from "react";
import { Suspense } from "react";

import { type PostHogProject, listPostHogProjects, validateAndConnect } from "@/app/actions/posthog";
import { Button, SelectField, TextField } from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";

function AuthenticationForm() {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";
  const router = useRouter();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [projectToken, setProjectToken] = React.useState("");
  const [personalApiKey, setPersonalApiKey] = React.useState("");
  const [projectTokenError, setProjectTokenError] = React.useState<string | null>(null);
  const [personalApiKeyError, setPersonalApiKeyError] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<PostHogProject[]>([]);
  const [projectId, setProjectId] = React.useState("");
  const [projectError, setProjectError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const projectOptions = React.useMemo(() => projects.map((p) => ({ value: String(p.id), label: p.name })), [projects]);

  const handleStep1 = async () => {
    setProjectTokenError(null);
    setPersonalApiKeyError(null);

    let hasError = false;
    if (!projectToken.trim()) {
      setProjectTokenError("Project token is required");
      hasError = true;
    } else if (!/^phc_/.test(projectToken.trim())) {
      setProjectTokenError("Project token must start with phc_");
      hasError = true;
    }

    if (!personalApiKey.trim()) {
      setPersonalApiKeyError("Personal API key is required");
      hasError = true;
    } else if (!/^phx_/.test(personalApiKey.trim())) {
      setPersonalApiKeyError("Personal API key must start with phx_");
      hasError = true;
    }

    if (hasError) return;

    setPending(true);
    try {
      const result = await listPostHogProjects(personalApiKey.trim());
      if (result.length === 0) {
        setPersonalApiKeyError("Couldn't fetch projects. Check your personal API key.");
        return;
      }
      setProjects(result);
      setProjectId(String(result[0].id));
      setStep(2);
    } finally {
      setPending(false);
    }
  };

  const handleStep2 = async () => {
    setProjectError(null);
    setServerError(null);

    if (!projectId) {
      setProjectError("Select a project to continue");
      return;
    }
    if (!appToken) {
      setServerError("App token not found");
      return;
    }

    setPending(true);
    try {
      const result = await validateAndConnect(projectToken.trim(), personalApiKey.trim(), projectId, appToken);
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
            <h2 className="text-base font-medium">Choose a project</h2>
            <p className="text-muted-foreground text-sm">Select the PostHog project to sync payment analytics into.</p>
          </div>

          <SelectField
            id="project"
            label="Project"
            value={projectId}
            onChange={setProjectId}
            items={projectOptions}
            placeholder="Select project"
            triggerClassName="shadow-none"
            error={projectError}
          />

          <p className="text-muted-foreground text-xs">
            The personal key can read across every project in your org, not just the one selected here.
          </p>

          {serverError && (
            <p className="text-destructive text-sm" role="alert">
              {serverError}
            </p>
          )}

          <Button className="w-full shadow-none" isLoading={pending} onClick={handleStep2}>
            {pending ? "Connecting…" : "Connect PostHog →"}
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
          <p className="text-muted-foreground text-sm">Add your PostHog keys to start tracking payment analytics.</p>
        </div>

        <div className="flex flex-col gap-6">
          <TextField
            id="project-token"
            label="Project token"
            placeholder="phc_xxxxxxxx"
            value={projectToken}
            onChange={setProjectToken}
            className="font-mono text-sm shadow-none"
            error={projectTokenError}
          />

          <TextField
            id="personal-api-key"
            label="Personal API key"
            placeholder="phx_xxxxxxxx"
            value={personalApiKey}
            onChange={setPersonalApiKey}
            className="font-mono text-sm shadow-none"
            error={personalApiKeyError}
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
