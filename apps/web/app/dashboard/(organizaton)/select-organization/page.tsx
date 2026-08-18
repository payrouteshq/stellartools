import { getCurrentUser } from "@/actions/auth";
import { getCurrentOrganization } from "@/actions/organization";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Client$SelectOrganizationPage } from "./page.client";

interface SelectOrganizationPageProps {
  searchParams: Promise<{
    next?: string;
    newOverride?: string;
  }>;
}

export default async function SelectOrganizationPage({
  searchParams: searchParamsPromise,
}: SelectOrganizationPageProps) {
  const searchParams = await searchParamsPromise;
  const user = await getCurrentUser();

  if (!user) redirect(`/signin?next=${searchParams.next ?? "/"}`);

  const currentOrg = await getCurrentOrganization();

  if (currentOrg && !searchParams.newOverride) redirect("/");

  const headersList = await headers();
  const xVercelIpCountry = headersList.get("x-vercel-ip-country");
  const acceptLanguage = headersList.get("accept-language");

  const userName = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <Client$SelectOrganizationPage
      xVercelIpCountry={xVercelIpCountry}
      acceptLanguage={acceptLanguage}
      autoOpen={!!searchParams?.newOverride}
      userEmail={user.email}
      userName={userName}
    />
  );
}
