import { getCustomerPortalData } from "@/actions/customers";
import { TestModeBanner } from "@/components/environment-mode";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getCustomerPortalData(token);

  const testnet = data?.environment === "testnet";

  return (
    <>
      {testnet && <TestModeBanner />}
      <div style={{ paddingTop: testnet ? "2rem" : "0" }} className="transition-[padding-top] duration-300 ease-in-out">
        {children}
      </div>
    </>
  );
}
