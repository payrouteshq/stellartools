import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current = payload.current as string[];
  if (session) {
    const apiUrl = process.env.STELLAR_TOOLS_API_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (apiUrl && secret) {
      await fetch(`${apiUrl}/shopify/sessions/${encodeURIComponent(session.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ scope: current.toString() }),
      });
    }
  }

  return new Response();
};
