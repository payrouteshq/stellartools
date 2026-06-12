import { getCustomerPortalData, getPortalSessionStatus } from "@/actions/customers";
import { TestModeBanner } from "@/components/environment-mode";

import { PortalSessionError } from "./_portal-error";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [data, sessionStatus] = await Promise.all([getCustomerPortalData(token), getPortalSessionStatus(token)]);

  if (!data?.customer) {
    return <PortalSessionError reason={sessionStatus === "expired" ? "expired" : "not_found"} />;
  }

  const testnet = data.environment === "testnet";

  return (
    <>
      {testnet && <TestModeBanner />}
      <div style={{ paddingTop: testnet ? "2rem" : "0" }} className="transition-[padding-top] duration-300 ease-in-out">
        {children}
      </div>
    </>
  );
}
