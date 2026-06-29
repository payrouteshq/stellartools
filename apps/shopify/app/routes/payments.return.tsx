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
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";

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

  const shopRecord = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, shopDomain))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!shopRecord?.stellartoolsApiKey || !shopRecord.accessToken) {
    return redirect("/");
  }

  // Check payment status from StellarTools
  let paymentSucceeded = false;

  if (checkoutId) {
    const st = new StellarTools({ api_key: shopRecord.stellartoolsApiKey });
    const checkout = await st.checkouts.retrieve(checkoutId);
    paymentSucceeded = checkout?.status === "completed";
  }

  // Call Shopify Payments API to resolve or reject the payment session
  const shopifyApiUrl = `https://${shopDomain}/payments/apps/2025-01/payment_sessions`;
  const mutation = paymentSucceeded ? RESOLVE_MUTATION : REJECT_MUTATION;
  const variables = paymentSucceeded
    ? { id: paymentGid }
    : { id: paymentGid, reason: { code: "RISKY", merchantMessage: "Payment was not completed." } };

  try {
    await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopRecord.accessToken,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
  } catch (err) {
    console.error("Failed to resolve Shopify payment session:", err);
  }

  // Redirect buyer back to Shopify — they'll land on the order page if resolved
  return redirect(`https://${shopDomain}/checkout`);
}
