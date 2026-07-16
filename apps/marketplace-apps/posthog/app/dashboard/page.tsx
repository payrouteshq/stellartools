"use client";

import * as React from "react";

import { Cohort, listCohorts } from "@/app/actions/db";
import { AppSettings, deleteCohort, logout } from "@/app/actions/posthog";
import { useStellarToolsContext, useStellarToolsMutation, useStellarToolsQuery } from "@stellartools/app-sdk";
import { type AppContext } from "@stellartools/app-sdk";
import { Button, Skeleton, Spinner } from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";

const Dashboard = () => {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";
  const router = useRouter();

  const { settings } = useStellarToolsContext();
  const appSettings = settings as unknown as AppSettings;

  const {
    data: cohorts = [],
    isLoading,
    refetch,
  } = useStellarToolsQuery<Cohort[]>(["cohorts"], (ctx: AppContext) => listCohorts(ctx.instId), {
    enabled: !!settings.posthogProjectToken,
  });

  const { mutate: removeCohort } = useStellarToolsMutation(
    async ({ id, posthogCohortId }: { id: string; posthogCohortId: string | null }) =>
      deleteCohort(id, posthogCohortId, appSettings),
    { onSuccess: () => refetch() }
  );

  const handleLogout = async () => {
    await logout(appToken);
    router.push(`/authentication?st_token=${appToken}`);
  };

  return (
    <div className="bg-background min-h-screen px-5 pb-10">
      <section className="flex flex-col gap-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">PostHog</h2>
            <p className="text-muted-foreground text-sm">Payment analytics for the last 30 days</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${appSettings.posthogHost}/project/${appSettings.posthogProjectId}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Go to PostHog ↗
            </a>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Cohorts */}
        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Cohorts</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">PostHog cohorts built from your payment events.</p>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs shadow-none"
              onClick={() => router.push(`/dashboard/cohort?st_token=${appToken}`)}
            >
              New cohort
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : cohorts.length === 0 ? (
            <div className="border-border rounded-lg border px-6 py-10 text-center">
              <p className="text-muted-foreground text-sm">No cohorts yet. Create one to start building segments.</p>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/cohort?st_token=${appToken}`)}
                className="text-foreground mt-2 text-sm underline underline-offset-4"
              >
                Create your first cohort
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  className="border-border flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{cohort.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {cohort.blocks.length} rule{cohort.blocks.length !== 1 ? "s" : ""} ·{" "}
                      {cohort.match === "all" ? "all must match" : "any must match"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/cohort?st_token=${appToken}&id=${cohort.id}`)}
                      className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCohort({ id: cohort.id, posthogCohortId: cohort.posthogCohortId })}
                      className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Dashboard />
    </React.Suspense>
  );
}
