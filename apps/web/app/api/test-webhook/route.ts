import { StellarTools } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const client = new StellarTools({ api_key: process.env.STELLARTOOLS_API_KEY! });
  const body = await req.text();
  const signature = req.headers.get("X-StellarTools-Signature")!;

  const event = client.webhooks.constructEvent(body, signature, process.env.STELLARTOOLS_WEBHOOK_SECRET!);

  if (event.type == "customer.created") {
    const customer = event.data.object;
    console.dir(customer, { depth: 100 });
  } else if (event.type == "customer.updated") {
    const customer = event.data.object;
    console.dir(customer, { depth: 100 });
  } else if (event.type == "customer.deleted") {
    const customer = event.data.object;
    console.dir(customer, { depth: 100 });
  } else if (event.type == "payment_method.created") {
    const paymentMethod = event.data.object;
    console.dir(paymentMethod, { depth: 100 });
  } else if (event.type == "payment_method.deleted") {
    const paymentMethod = event.data.object;
    console.dir(paymentMethod, { depth: 100 });
  } else if (event.type == "checkout.created") {
    const checkout = event.data.object;
    console.dir(checkout, { depth: 100 });
  } else if (event.type == "payment.confirmed") {
    const payment = event.data.object;
    console.dir(payment, { depth: 100 });
  } else if (event.type == "payment.pending") {
    const payment = event.data.object;
    console.dir(payment, { depth: 100 });
  } else if (event.type == "payment.failed") {
    const payment = event.data.object;
    console.dir(payment, { depth: 100 });
  } else if (event.type == "refund.succeeded") {
    const refund = event.data.object;
    console.dir(refund, { depth: 100 });
  } else if (event.type == "refund.failed") {
    const refund = event.data.object;
    console.dir(refund, { depth: 100 });
  } else if (event.type == "subscription.created") {
    const subscription = event.data.object;
    console.dir(subscription, { depth: 100 });
  } else if (event.type == "subscription.updated") {
    const subscription = event.data.object;
    console.dir(subscription, { depth: 100 });
  } else if (event.type == "subscription.canceled") {
    const subscription = event.data.object;
    console.dir(subscription, { depth: 100 });
  } else {
    console.dir(event, { depth: 100 });
  }

  return NextResponse.json({ received: true });
}
