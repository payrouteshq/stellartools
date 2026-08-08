import { retrieveAppInstallations } from "@/actions/app";
import { getCurrentUser } from "@/actions/auth";
import { getCurrentOrganization } from "@/actions/organization";
import { PluginLauncher } from "@/components/plugin-launcher";
import { cn } from "@stellartools/shared-ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const headerlist = await headers();
  const url = headerlist.get("x-url");

  if (!user) redirect(`/signin?next=${url}&clearKeys=accessToken,refreshToken,selectedOrg`);

  let orgLookupFailed = false;

  const currentOrg = await getCurrentOrganization(async (error) => {
    if (error.includes("No organization context found")) orgLookupFailed = true;
  });

  if (!currentOrg) {
    const target = `/select-organization?next=${url}`;
    redirect(orgLookupFailed ? `${target}&clearKeys=selectedOrg` : target);
  }

  const installationsWithApps = await retrieveAppInstallations(
    { status: "active" },
    currentOrg?.id,
    currentOrg?.environment
  );

  const hasApps = installationsWithApps.length > 0;

  return (
    <div className={cn(hasApps && "transition-all duration-300 md:mr-12")}>
      {children}
      {hasApps && (
        <PluginLauncher
          installationsWithApps={installationsWithApps.map((p) => ({ installation: p.app_installation, app: p.app }))}
        />
      )}
    </div>
  );
}
