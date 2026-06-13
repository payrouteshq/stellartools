import * as React from "react";

import { getCurrentUser } from "@/actions/auth";
import { getCurrentOrganization } from "@/actions/organization";
import { redirect } from "next/navigation";

export default async function SelectOrganizationLayout({ children }: React.PropsWithChildren) {
  const user = await getCurrentUser();

  if (!user) redirect("/signin");

  const currentOrg = await getCurrentOrganization();

  if (currentOrg) redirect("/");

  return <>{children}</>;
}
