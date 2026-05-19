import { getCurrentUser } from "@/actions/auth";
import { getCurrentOrganization } from "@/actions/organization";
import { PluginLauncher } from "@/components/dashboard/plugin-launcher";
import { MainnetReadinessModal } from "@/components/mainnet-readiness-modal";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const headerlist = await headers();
  const url = headerlist.get("x-url");

  if (!user) redirect(`/signin?next=${url}`);

  const currentOrg = await getCurrentOrganization();

  if (!currentOrg) redirect(`/select-organization?next=${url}`);

  return (
    <div className={cn(process.env.NEXT_PUBLIC_SHOW_MARKETPLACE_LAUNCHER === "true" ? "mr-8" : "")}>
      {children}
      <MainnetReadinessModal />
      <PluginLauncher />
    </div>
  );
}
