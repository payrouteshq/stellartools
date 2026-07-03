/**
 * Buyer lands here after completing (or abandoning) the StellarTools checkout.
 *
 * We check the ST checkout status and call Shopify's paymentSessionResolve
 * (success) or paymentSessionReject (failure/cancel) mutation, then redirect
 * the buyer to Shopify's order confirmation page.
 *
 * Requires Payments Partner access for the paymentSessionResolve mutation to work.
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StellarTools } from "@stellartools/core";
import { getShopByDomain } from "~/db.server";

const RESOLVE_MUTATION = `
  mutation PaymentSessionResolve($id: ID!) {
    paymentSessionResolve(id: $id) {
      paymentSession { id state { code } }
      userErrors { field message }
    }
  }
`;

const REJECT_MUTATION = `
  mutation PaymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
    paymentSessionReject(id: $id, reason: $reason) {
      paymentSession { id state { code } }
      userErrors { field message }
    }
  }
`;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const paymentGid = url.searchParams.get("gid");
  const shopDomain = url.searchParams.get("shop");
  const checkoutId = url.searchParams.get("checkout_id");

  if (!paymentGid || !shopDomain) {
    return redirect("/");
  }

  const shopRecord = await getShopByDomain(shopDomain);

  if (!shopRecord?.stellartools_api_key || !shopRecord.access_token) {
    return redirect("/");
  }

  // Check payment status from StellarTools
  let paymentSucceeded = false;

  if (checkoutId) {
    const st = new StellarTools({ api_key: shopRecord.stellartools_api_key! });
    const checkout = await st.checkouts.retrieve(checkoutId);
    paymentSucceeded = checkout?.status === "completed";
  }

  // Call Shopify Payments API to resolve or reject the payment session
  // Shopify Payments Apps GraphQL API — different from the admin API
  const shopifyApiUrl = `https://${shopDomain}/payments_apps/api/2025-10/graphql.json`;
  const mutation = paymentSucceeded ? RESOLVE_MUTATION : REJECT_MUTATION;
  const variables = paymentSucceeded
    ? { id: paymentGid }
    : { id: paymentGid, reason: { code: "RISKY", merchantMessage: "Payment was not completed." } };

  try {
    await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopRecord.access_token,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
  } catch (err) {
    console.error("Failed to resolve Shopify payment session:", err);
  }

  // Redirect buyer back to Shopify — they'll land on the order page if resolved
  return redirect(`https://${shopDomain}/checkout`);
}
