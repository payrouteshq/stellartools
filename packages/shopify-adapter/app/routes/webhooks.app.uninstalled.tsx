import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const apiUrl = process.env.STELLAR_TOOLS_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (apiUrl && secret) {
    await fetch(`${apiUrl}/shopify/connect`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ shop }),
    });
  }

  return new Response();
};
