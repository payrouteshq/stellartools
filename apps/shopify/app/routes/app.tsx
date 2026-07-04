import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { AppNavMenu } from "~/components/app-nav-menu";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[app] authenticate.admin", new URL(request.url).pathname);
  await authenticate.admin(request);
  return null;
}

export default function AppLayout() {
  return (
    <>
      <AppNavMenu />
      <Outlet />
    </>
  );
}
