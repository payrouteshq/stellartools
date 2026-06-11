"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground max-w-xs text-sm">
          An unexpected error occurred. Try again or go back to safety.
        </p>
        {error.digest && <p className="text-muted-foreground/50 mt-1 font-mono text-xs">Error ID: {error.digest}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={reset}>Try again</Button>
        <Button onClick={() => router.push("/")}>Back to home</Button>
      </div>
    </div>
  );
}
