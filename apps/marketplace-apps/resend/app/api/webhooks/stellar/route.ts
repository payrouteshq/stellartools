import { WebhookSigner, type WebhookEvent } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type Settings = {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  customerSyncEnabled?: boolean;
  notificationRules?: Record<string, { sendReceipt: boolean; enabled: boolean }>;
  paymentReceivedTemplateId?: string;
  paymentFailedTemplateId?: string;
  refundSucceededTemplateId?: string;
  subscriptionCreatedTemplateId?: string;
  subscriptionCanceledTemplateId?: string;
  customerWelcomeTemplateId?: string;
};

const wh = new WebhookSigner();

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";

  let event: WebhookEvent;
  let settings: Settings;
  try {
    ({ event, settings } = wh.constructEvent(rawBody, signature, process.env.WEBHOOK_SECRET!) as unknown as { event: WebhookEvent; settings: Settings });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;

  switch (event.type) {
    case "payment.confirmed": {
      if (settings.notificationRules?.["payment.confirmed"]?.sendReceipt === false) break;
      if (!settings.paymentReceivedTemplateId) break;
      const payment = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        template: {
          id: settings.paymentReceivedTemplateId,
          variables: { amount: String(payment.amount), transaction_hash: payment.transaction_hash ?? "" },
        },
      });
      break;
    }

    case "payment.failed": {
      if (settings.notificationRules?.["payment.failed"]?.sendReceipt === false) break;
      if (!settings.paymentFailedTemplateId) break;
      const payment = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        template: {
          id: settings.paymentFailedTemplateId,
          variables: { amount: String(payment.amount) },
        },
      });
      break;
    }

    case "refund.succeeded": {
      if (settings.notificationRules?.["refund.succeeded"]?.sendReceipt === false) break;
      if (!settings.refundSucceededTemplateId) break;
      const refund = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        template: {
          id: settings.refundSucceededTemplateId,
          variables: { amount: String(refund.amount) },
        },
      });
      break;
    }

    case "subscription.created": {
      if (settings.notificationRules?.["subscription.created"]?.sendReceipt === false) break;
      if (!settings.subscriptionCreatedTemplateId) break;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        template: { id: settings.subscriptionCreatedTemplateId },
      });
      break;
    }

    case "subscription.canceled": {
      if (settings.notificationRules?.["subscription.canceled"]?.enabled === false) break;
      if (!settings.subscriptionCanceledTemplateId) break;
      const sub = event.data.object;
      await resend.emails.send({
        from,
        to: settings.fromEmail,
        template: {
          id: settings.subscriptionCanceledTemplateId,
          variables: { canceled_at: sub.canceled_at ?? "" },
        },
      });
      break;
    }

    case "customer.created": {
      const { email, name } = event.data.object;

      if (settings.customerSyncEnabled) {
        await resend.contacts.create({ email, firstName: name, unsubscribed: false });
      }

      if (settings.notificationRules?.["customer.created"]?.sendReceipt !== false && settings.customerWelcomeTemplateId) {
        await resend.emails.send({
          from,
          to: email,
          template: { id: settings.customerWelcomeTemplateId, variables: { name } },
        });
      }

      break;
    }
  }

  return NextResponse.json({ ok: true });
}
