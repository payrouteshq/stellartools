import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[auth] callback", new URL(request.url).pathname);
  await authenticate.admin(request);
  return null;
};
