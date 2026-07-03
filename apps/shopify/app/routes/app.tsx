import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function AppLayout() {
  return (
    <>
      <NavMenu>
        <a href="/app" rel="home">
          Dashboard
        </a>
        <a href="/app/transactions">Transactions</a>
        <a href="/app/subscriptions">Subscriptions</a>
        <a href="/app/products">Products</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <Outlet />
    </>
  );
}
