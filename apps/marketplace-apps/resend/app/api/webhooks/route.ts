import { type EventType } from "@stellartools/app-embed-bridge";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type NotificationRule = { enabled: boolean; template: string | null };

type WebhookPayload = {
  type: EventType;
  installationId: string;
  data: {
    customer?: { name?: string; email: string };
    payment?: { amountCents?: number; currency?: string; txHash?: string };
    product?: { name?: string };
    subscription?: { accessEndsAt?: string };
    refund?: { amountCents?: number };
    reason?: string;
  };
  settings: {
    resendApiKey: string;
    fromEmail: string;
    fromName?: string;
    notificationRules?: Record<string, NotificationRule>;
  };
};

const EMAIL_SUBJECTS: Partial<Record<EventType, string>> = {
  "payment::completed": "Your payment was received",
  "payment::failed": "Your payment didn't go through",
  "refund::created": "Your refund has been processed",
  "refund::failed": "There was an issue with your refund",
  "subscription::created": "Your subscription is active",
  "subscription::updated": "Your subscription has been updated",
  "subscription::canceled": "Your subscription has been canceled",
  "checkout::created": "Complete your checkout",
};

function buildEmailHtml(type: EventType, data: WebhookPayload["data"]): string {
  const name = data.customer?.name ?? "there";
  const productName = data.product?.name ?? "our service";
  const amount =
    data.payment?.amountCents != null
      ? `${(data.payment.amountCents / 100).toFixed(2)} ${data.payment.currency ?? "USD"}`
      : null;

  switch (type) {
    case "payment::completed":
      return [
        `<p>Hi ${name},</p>`,
        `<p>Your payment${amount ? ` of <strong>${amount}</strong>` : ""} was confirmed.</p>`,
        data.payment?.txHash ? `<p>Transaction: <code>${data.payment.txHash}</code></p>` : "",
      ].join("");

    case "payment::failed":
      return [
        `<p>Hi ${name},</p>`,
        `<p>Your payment${amount ? ` of <strong>${amount}</strong>` : ""} couldn't be processed.`,
        data.reason ? ` Reason: ${data.reason}.` : "",
        ` Please try again.</p>`,
      ].join("");

    case "refund::created":
      return `<p>Hi ${name},</p><p>Your refund${amount ? ` of <strong>${amount}</strong>` : ""} has been sent to your wallet.</p>`;

    case "refund::failed":
      return `<p>Hi ${name},</p><p>We couldn't process your refund. Please contact support.</p>`;

    case "subscription::created":
      return `<p>Hi ${name},</p><p>Your subscription to <strong>${productName}</strong> is now active.</p>`;

    case "subscription::updated":
      return `<p>Hi ${name},</p><p>Your subscription to <strong>${productName}</strong> has been updated.</p>`;

    case "subscription::canceled":
      return [
        `<p>Hi ${name},</p>`,
        `<p>Your subscription to <strong>${productName}</strong> has been canceled.`,
        data.subscription?.accessEndsAt
          ? ` Your access ends on <strong>${data.subscription.accessEndsAt}</strong>.`
          : "",
        `</p>`,
      ].join("");

    default:
      return `<p>Hi ${name},</p><p>An update has occurred on your account.</p>`;
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", process.env.STELLARTOOLS_APP_SECRET!).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-stellartools-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data, settings } = body;

  // customer::* events drive contact sync, not transactional email
  if (type.startsWith("customer::")) {
    return NextResponse.json({ ok: true });
  }

  const rule = settings.notificationRules?.[type];
  if (rule && !rule.enabled) {
    return NextResponse.json({ ok: true, skipped: "rule disabled" });
  }

  const to = data.customer?.email;
  if (!to) {
    return NextResponse.json({ error: "No customer email in payload" }, { status: 422 });
  }

  const resend = new Resend(settings.resendApiKey);

  await resend.emails.send({
    from: settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail,
    to,
    subject: EMAIL_SUBJECTS[type] ?? "Update from your account",
    html: buildEmailHtml(type, data),
  });

  return NextResponse.json({ ok: true });
}
