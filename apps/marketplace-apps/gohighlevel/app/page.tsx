"use client";

import * as React from "react";

import { Button } from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

function Connect() {
  const token = useSearchParams().get("st_token");

  if (!token) {
    return <p className="text-muted-foreground text-sm">Open this app from your StellarTools dashboard.</p>;
  }

  return (
    <Button asChild className="w-full shadow-none">
      <a href={`/api/connect?token=${encodeURIComponent(token)}`} target="_top" rel="noopener noreferrer">
        Connect GoHighLevel
      </a>
    </Button>
  );
}

export default function Page() {
  return (
    <div className="bg-background min-h-screen px-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 text-center">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect GoHighLevel</h2>
          <p className="text-muted-foreground text-sm">
            Provisions StellarTools as a payment provider on a GoHighLevel sub-account — no API keys to copy.
          </p>
        </div>
        <React.Suspense>
          <Connect />
        </React.Suspense>
        <p className="text-muted-foreground text-xs">
          You&apos;ll be sent to GoHighLevel to choose a sub-account and approve access, then back here once connected.
        </p>
      </section>
    </div>
  );
}
