"use client";

import { EnvironmentToggle } from "@/components/environment-mode";
import ModeToggle from "@/components/mode-toggle";
import { useOrgContext } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@stellartools/shared-ui";

export default function DashboardHeader() {
  const { data: orgContext } = useOrgContext();
  const currentEnvironment = orgContext?.environment;

  return (
    <header className={cn("bg-sidebar shrink-0")}>
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-3">
          <ModeToggle />
          {currentEnvironment && <EnvironmentToggle currentEnvironment={currentEnvironment} />}
        </div>
      </div>
    </header>
  );
}

DashboardHeader.displayName = "DashboardHeader";
