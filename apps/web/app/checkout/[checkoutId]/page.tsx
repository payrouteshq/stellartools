import { CheckoutProvider } from "@/contexts/checkout-context";

import CheckoutUI from "./checkout-ui";

export default async function Page({ params }: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await params;

  return (
    <CheckoutProvider checkoutId={checkoutId}>
      <CheckoutUI />
    </CheckoutProvider>
  );
}
