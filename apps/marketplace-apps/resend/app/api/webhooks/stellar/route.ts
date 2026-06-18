import type { WebhookEvent } from "@stellartools/core";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type Settings = {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  syncEnabled?: boolean;
  notificationRules?: Record<string, { sendReceipt: boolean; template: string; enabled: boolean }>;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature");
  const expected = `sha256=${createHmac("sha256", process.env.WEBHOOK_SECRET!).update(rawBody).digest("hex")}`;

  if (!signature || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, settings }: { event: WebhookEvent; settings: Settings } = JSON.parse(rawBody);
  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;

  switch (event.type) {
    case "payment.confirmed": {
      if (settings.notificationRules?.["payment.confirmed"]?.sendReceipt === false) break;
      const payment = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        subject: "Your payment was received",
        html: `<p>Your payment of <strong>${payment.amount}</strong> was confirmed. Transaction: <code>${payment.transaction_hash}</code></p>`,
      });
      break;
    }

    case "payment.failed": {
      if (settings.notificationRules?.["payment.failed"]?.sendReceipt === false) break;
      const payment = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        subject: "Your payment didn't go through",
        html: `<p>Your payment of <strong>${payment.amount}</strong> couldn't be processed. Please try again.</p>`,
      });
      break;
    }

    case "refund.succeeded": {
      if (settings.notificationRules?.["refund.succeeded"]?.sendReceipt === false) break;
      const refund = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        subject: "Your refund has been processed",
        html: `<p>Your refund of <strong>${refund.amount}</strong> has been sent to your wallet.</p>`,
      });
      break;
    }

    case "subscription.created": {
      if (settings.notificationRules?.["subscription.created"]?.sendReceipt === false) break;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        subject: "Your subscription is active",
        html: `<p>Your subscription is now active.</p>`,
      });
      break;
    }

    case "subscription.canceled": {
      if (settings.notificationRules?.["subscription.canceled"]?.enabled === false) break;
      const sub = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        subject: "Your subscription has been canceled",
        html: `<p>Your subscription has been canceled.${sub.canceled_at ? ` Effective: ${sub.canceled_at}.` : ""}</p>`,
      });
      break;
    }

    case "checkout.created": {
      if (!settings.syncEnabled) break;
      const { customer_id } = event.data.object;
      if (!customer_id) break;
      // TODO: replace customer_id with customer email once StellarTools expands the customer on checkout events
      await resend.contacts.create({ email: customer_id, unsubscribed: false });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
