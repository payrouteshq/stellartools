"use client";

import * as React from "react";

import CheckoutUI from "@/app/checkout/[checkoutId]/checkout-ui";
import { CheckoutProvider, useCheckout } from "@/contexts/checkout-context";
import { IframeInboundMessage, buildErrorMessage, buildReadyMessage, buildSuccessMessage, parseGhlIframeMessage } from "@/lib/ghl-iframe";

/** Reports payment completion back to the HighLevel parent frame without touching CheckoutUI itself. */
function GhlBridge() {
  const { id, isPaid, isFailed } = useCheckout();

  React.useEffect(() => {
    if (isPaid) window.parent.postMessage(buildSuccessMessage(id), "*");
    if (isFailed) window.parent.postMessage(buildErrorMessage("Payment was not completed"), "*");
  }, [id, isPaid, isFailed]);

  return null;
}

/** The `paymentsUrl` HighLevel loads in an iframe on its checkout pages — see lib/ghl-iframe.ts. */
export default function GhlCheckoutPage() {
  const [checkoutId, setCheckoutId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const post = React.useCallback((message: unknown) => window.parent.postMessage(message, "*"), []);

  React.useEffect(() => {
    post(buildReadyMessage());
  }, [post]);

  const startCheckout = React.useCallback(
    async (props: Extract<IframeInboundMessage, { type: "payment_initiate_props" }>) => {
      try {
        const res = await fetch("/api/ghl/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(props),
        });
        if (!res.ok) throw new Error("Could not start checkout");
        const data = (await res.json()) as { checkoutId: string };
        setCheckoutId(data.checkoutId);
      } catch (err) {
        const description = err instanceof Error ? err.message : "Could not start checkout";
        setError(description);
        post(buildErrorMessage(description));
      }
    },
    [post]
  );

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message = parseGhlIframeMessage(event.data);
      if (!message) return;

      if (message.type === "payment_initiate_props") {
        startCheckout(message);
      } else if (message.type === "setup_initiate_props") {
        post(buildErrorMessage("Saved payment methods are not supported by this provider."));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, startCheckout]);

  if (error) return <p className="text-destructive p-6 text-center text-sm">{error}</p>;
  if (!checkoutId) return null;

  return (
    <CheckoutProvider checkoutId={checkoutId}>
      <CheckoutUI />
      <GhlBridge />
    </CheckoutProvider>
  );
}
