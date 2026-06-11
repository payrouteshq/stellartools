import { headers } from "next/headers";

import { Client$SelectOrganizationPage } from "./page.client";

export default async function SelectOrganizationPage() {
  const headersList = await headers();
  const xVercelIpCountry = headersList.get("x-vercel-ip-country");
  const acceptLanguage = headersList.get("accept-language");

  return <Client$SelectOrganizationPage xVercelIpCountry={xVercelIpCountry} acceptLanguage={acceptLanguage} />;
}
