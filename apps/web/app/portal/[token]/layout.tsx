import { getCustomerPortalData, getPortalSessionStatus } from "@/actions/customers";
import { TestModeBanner } from "@/components/environment-mode";
import { getCookie } from "@/integrations/cookie-manager";
import crypto from "crypto";

import { PortalAuthGate } from "./_portal-auth";
import { PortalSessionError } from "./_portal-error";

function isValidAuthCookie(token: string, value: string | undefined): boolean {
  if (!value) return false;
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

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

  const authCookie = await getCookie(`portal_auth_${token.slice(0, 20)}`);

  if (!isValidAuthCookie(token, authCookie)) {
    return <PortalAuthGate token={token} org={data.organization} />;
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
