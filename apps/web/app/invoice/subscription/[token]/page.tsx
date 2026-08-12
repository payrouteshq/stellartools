import { retrieveSubscriptionInvoice } from "@/actions/subscription";
import { notFound } from "next/navigation";

import { SubscriptionInvoiceUI } from "./subscription-invoice-ui";

export default async function SubscriptionInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await retrieveSubscriptionInvoice(token);

  if (!invoice) notFound();

  return <SubscriptionInvoiceUI invoice={invoice} />;
}
