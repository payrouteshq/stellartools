"use client";

import { EnvironmentToggle } from "@/components/environment-mode";
import ModeToggle from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useOrgContext } from "@/hooks/use-org-query";

export default function DashboardHeader() {
  const { data: orgContext } = useOrgContext();
  const currentEnvironment = orgContext?.environment;

  return (
    <header>
      <div className="container flex h-14 items-center justify-between gap-4 px-4">
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
