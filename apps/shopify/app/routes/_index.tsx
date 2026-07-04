import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("[index] authenticate.admin", url.pathname);
  await authenticate.admin(request);
  throw redirect(`/app${url.search}`);
};
