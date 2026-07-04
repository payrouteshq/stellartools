/**
 * GDPR mandatory webhooks. Shopify will reject your app from the App Store
 * if these are not implemented. Must respond within 30 days for data requests.
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, payload, shop } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      // A customer has requested their data. Log the request — you have 30 days to respond.
      // In production: look up ST customer by email and send data to the requester.
      const data = payload as { customer: { email: string }; orders_requested: number[] };
      console.log(`[GDPR] Data request for ${data.customer.email} at ${shop}`);
      break;
    }

    case "CUSTOMERS_REDACT": {
      // Shopify requests deletion of customer data (called 10 days after uninstall).
      // In production: anonymize or delete the ST customer record for this email.
      const data = payload as { customer: { email: string } };
      console.log(`[GDPR] Customer redact for ${data.customer.email} at ${shop}`);
      break;
    }

    case "SHOP_REDACT": {
      // Shopify requests deletion of all shop data (called 48h after uninstall).
      // In production: delete all ST data associated with this shop's org.
      console.log(`[GDPR] Shop redact for ${shop}`);
      break;
    }

    default:
      console.warn(`[GDPR] Unknown topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
