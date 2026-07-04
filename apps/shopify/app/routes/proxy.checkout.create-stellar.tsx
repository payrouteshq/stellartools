/**
 * App proxy entry — same-origin from storefront, no CORS.
 * Storefront: POST /apps/stellartools/checkout/create-stellar
 * Proxied to: POST /proxy/checkout/create-stellar?shop=...
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { createStellarCheckout } from "~/unstable-checkout.server";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  return json({ error: "Method not allowed" }, 405);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  let body: Parameters<typeof createStellarCheckout>[0];
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const url = new URL(request.url);
  if (!body.shop_domain && url.searchParams.get("shop")) {
    body = { ...body, shop_domain: url.searchParams.get("shop")! };
  }

  const result = await createStellarCheckout(body);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ payment_url: result.payment_url });
};
