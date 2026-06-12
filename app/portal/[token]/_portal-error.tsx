"use client";

import { StellarTools } from "@/components/icon";
import { ModeToggle } from "@/components/mode-toggle";

const MESSAGES = {
  expired: {
    title: "Session expired",
    body: "This portal link has expired. Contact the merchant to generate a new one.",
  },
  not_found: {
    title: "Link not found",
    body: "This portal link is invalid or has already been used. Contact the merchant for a new link.",
  },
} satisfies Record<string, { title: string; body: string }>;

export function PortalSessionError({ reason }: { reason: keyof typeof MESSAGES }) {
  const { title, body } = MESSAGES[reason];

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border bg-background hidden w-[280px] shrink-0 flex-col border-r px-8 py-10 md:flex">
        <div className="mb-6 flex items-center gap-3">
          <StellarTools width={28} height={28} className="shrink-0 object-contain" />
          <span className="text-foreground truncate text-sm font-semibold">StellarTools</span>
        </div>
        <div className="mt-auto flex justify-end">
          <ModeToggle />
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-border flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            <StellarTools width={24} height={24} className="shrink-0 object-contain" />
            <span className="text-foreground text-sm font-semibold">StellarTools</span>
          </div>
          <ModeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <p className="text-foreground text-lg font-semibold">{title}</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">{body}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
