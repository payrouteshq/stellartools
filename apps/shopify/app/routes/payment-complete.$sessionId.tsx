/**
 * Customers land here after paying (or cancelling) on StellarTools.
 * We check the StellarTools checkout status, resolve or reject the Shopify payment
 * session, then redirect the customer to wherever Shopify says to go next.
 */
import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { StellarTools } from "@stellartools/core";
import { rejectPaymentSession, resolvePaymentSession } from "~/payments-apps.server";
import { getPaymentSessionById, getShopByDomain, markPaymentSessionResolved } from "~/db.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const sessionId = params.sessionId!;
  const paymentSession = await getPaymentSessionById(sessionId);

  if (!paymentSession) {
    // Unknown session — send customer to a safe fallback
    return redirect("/");
  }

  // Already resolved by the StellarTools webhook backup — redirect based on stored cancel_url fallback
  if (paymentSession.status === "resolved") {
    return redirect(`https://${paymentSession.shop}`);
  }

  const shopRecord = await getShopByDomain(paymentSession.shop);
  if (!shopRecord?.stellartools_api_key) {
    return redirect(paymentSession.cancel_url);
  }

  const st = new StellarTools({ api_key: shopRecord.stellartools_api_key });
  let checkout;
  try {
    checkout = await st.checkouts.retrieve(paymentSession.stellartools_checkout_id!);
  } catch {
    const fallback = await rejectPaymentSession(
      paymentSession.shop,
      shopRecord.access_token,
      paymentSession.gid
    );
    return redirect(fallback ?? paymentSession.cancel_url);
  }

  if (checkout.status === "completed") {
    await markPaymentSessionResolved(sessionId);
    const nextUrl = await resolvePaymentSession(
      paymentSession.shop,
      shopRecord.access_token,
      paymentSession.gid
    );
    return redirect(nextUrl ?? `https://${paymentSession.shop}/`);
  }

  if (checkout.status === "failed" || checkout.status === "expired") {
    const fallback = await rejectPaymentSession(
      paymentSession.shop,
      shopRecord.access_token,
      paymentSession.gid,
      checkout.status === "expired" ? "Payment session expired" : "Payment failed"
    );
    return redirect(fallback ?? paymentSession.cancel_url);
  }

  // Still open — customer may have closed the tab early. Show a waiting page.
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
    <title>Processing payment…</title>
    <meta http-equiv="refresh" content="3">
    </head><body style="font-family:sans-serif;text-align:center;padding:4rem">
    <p>Verifying your payment — please wait…</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
};
