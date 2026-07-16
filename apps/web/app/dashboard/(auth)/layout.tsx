import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user) redirect("/");

  return <div>{children}</div>;
}
