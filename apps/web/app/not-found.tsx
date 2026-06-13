"use client";

import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-background">
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <Image src="/images/sad.gif" alt="Lost in space" width={160} height={160} unoptimized />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground max-w-xs text-sm">Looks like this page got lost in the cosmos.</p>
        </div>
        <Link
          href="/"
          className="text-foreground border-border hover:bg-muted rounded-lg border px-5 py-2 text-sm font-medium transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
