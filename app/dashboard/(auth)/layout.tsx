import { getCurrentUser } from "@/actions/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user) redirect( "/");

  return <div>{children}</div>;
}
