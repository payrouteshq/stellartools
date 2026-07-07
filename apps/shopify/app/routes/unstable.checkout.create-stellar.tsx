/**
 * UNSTABLE — demo-only direct route (tunnel URL). Prefer app proxy on storefront.
 * Route: POST /unstable/checkout/create-stellar
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { createStellarCheckout } from "~/unstable-checkout.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  return json({ error: "Method not allowed" }, 405);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  let body: Parameters<typeof createStellarCheckout>[0];
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const result = await createStellarCheckout(body);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ payment_url: result.payment_url });
};
