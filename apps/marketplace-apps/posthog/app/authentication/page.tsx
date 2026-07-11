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

  const [projectToken, setProjectToken] = React.useState("");
  const [personalApiKey, setPersonalApiKey] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [projects, setProjects] = React.useState<PostHogProject[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const projectOptions = React.useMemo(
    () => projects.map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const fetchProjects = async () => {
    if (!personalApiKey || !projectToken) return;
    setProjectsLoading(true);
    setError(null);
    const result = await listPostHogProjects(personalApiKey);
    if (result.length === 0) {
      setError("Couldn't fetch projects. Check your personal API key.");
    } else {
      setProjects(result);
      if (!projectId) setProjectId(String(result[0].id));
    }
    setProjectsLoading(false);
  };

  const handleConnect = async () => {
    setError(null);
    if (!projectToken || !personalApiKey) {
      setError("Both keys are required");
      return;
    }
    if (!projectId) {
      setError("Select a project to continue");
      return;
    }
    if (!appToken) {
      setError("App token not found");
      return;
    }
    setPending(true);
    try {
      const result = await validateAndConnect(projectToken, personalApiKey, projectId, appToken);
      if (result !== true) {
        setError(result);
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
          <p className="text-muted-foreground text-sm">Add your PostHog keys to start tracking payment analytics.</p>
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            id="project-token"
            label="Project token"
            placeholder="phc_xxxxxxxx"
            value={projectToken}
            onChange={setProjectToken}
            onBlur={fetchProjects}
            className="font-mono text-sm shadow-none"
          />

          <TextField
            id="personal-api-key"
            label="Personal API key"
            placeholder="phx_xxxxxxxx"
            value={personalApiKey}
            onChange={setPersonalApiKey}
            onBlur={fetchProjects}
            className="font-mono text-sm shadow-none"
          />

          <SelectField
            id="project"
            label="Project"
            value={projectId}
            onChange={setProjectId}
            items={projectOptions}
            placeholder="Select project — fetched after key entry"
            disabled={projectOptions.length === 0 || projectsLoading}
            isLoading={projectsLoading}
            triggerClassName="shadow-none"
          />

          {error && <p className="text-destructive text-sm">{error}</p>}

          <p className="text-muted-foreground text-xs">
            The personal key can read across every project in your org, not just the one selected here.
          </p>

          <Button className="w-full shadow-none" isLoading={pending} onClick={handleConnect}>
            {pending ? "Connecting…" : "Connect PostHog →"}
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
