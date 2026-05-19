"use client";

import DashboardHeader from "@/components/dashboard/dashboard-header";
import { SidebarInset } from "@/components/ui/sidebar";
import { useOrgContext } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";

export const DashboardSidebarInset = ({ children }: { children: React.ReactNode }) => {
  const { data: orgContext } = useOrgContext();
  const isTestMode = orgContext?.environment === "testnet";

  return (
    <SidebarInset
      className={cn(
        "bg-sidebar m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0",
        isTestMode && "pt-8"
      )}
    >
      <DashboardHeader />
      
        <div className="mb-2 min-h-0 flex-1 overflow-hidden rounded-tl-4xl border-t border-l border-border bg-card ">
          <div className="scrollbar-sidebar h-full overflow-y-auto">{children}</div>
        </div>
      
    </SidebarInset>
  );
};
