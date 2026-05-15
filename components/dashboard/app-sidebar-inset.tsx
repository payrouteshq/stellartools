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
        "bg-sidebar! flex min-h-svh flex-col overflow-hidden transition-all duration-300",
        isTestMode && "mt-8"
      )}
    >
      <DashboardHeader />
      <div className="bg-sidebar-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[1.75rem] rounded-bl-[1.75rem] p-px">
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-tl-[calc(1.75rem-1px)] rounded-bl-[calc(1.75rem-1px)]">
          {children}
        </div>
      </div>
    </SidebarInset>
  );
};
