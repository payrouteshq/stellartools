import { retrievePayments } from "@/actions/payment";
import { notFound } from "next/navigation";

import { InvoiceUI } from "./invoice-ui";

export default async function InvoicePage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;

  const {
    data: [resolvedPayment],
  } = await retrievePayments(
    undefined,
    undefined,
    { paymentId: paymentId, publicAccess: true },
    { withCustomer: true, withOrg: true }
  );

  if (!resolvedPayment) notFound();

  return <InvoiceUI resolvedPayment={resolvedPayment} />;
}
