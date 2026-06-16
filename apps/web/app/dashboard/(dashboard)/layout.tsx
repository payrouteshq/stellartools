import { getCurrentUser } from "@/actions/auth";
import { getCurrentOrganization } from "@/actions/organization";
import { MainnetReadinessModal } from "@/components/mainnet-readiness-modal";
import { PluginLauncher } from "@/components/plugin-launcher";
import { deleteCookies } from "@/integrations/cookie-manager";
import { cn } from "@stellartools/shared-ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const headerlist = await headers();
  const url = headerlist.get("x-url");

  if (!user) redirect(`/signin?next=${url}`);

  const currentOrg = await getCurrentOrganization(async (error) => {
    if (error.includes("No organization context found")) {
      await deleteCookies(["selectedOrg"]);
    }
  });

  if (!currentOrg) redirect(`/select-organization?next=${url}`);

  return (
    <div className={cn(process.env.NEXT_PUBLIC_SHOW_MARKETPLACE_LAUNCHER !== "false" ? "mr-12" : "")}>
      {children}
      <MainnetReadinessModal />
      <PluginLauncher />
    </div>
  );
}
