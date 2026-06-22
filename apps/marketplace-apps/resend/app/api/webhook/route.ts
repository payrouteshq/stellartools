import { type WebhookEvent, WebhookSigner } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type TemplateIds = Partial<
  Record<
    | "paymentReceivedTemplateId"
    | "paymentFailedTemplateId"
    | "refundSucceededTemplateId"
    | "subscriptionCreatedTemplateId"
    | "subscriptionCanceledTemplateId"
    | "customerWelcomeTemplateId",
    string | null
  >
>;

type Settings = {
  resendApiKey: string;
  fromEmail: string;
  segmentId?: string;
  customerSyncEnabled?: boolean;
} & TemplateIds;

const wh = new WebhookSigner();

function toVariables(obj: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v != null && typeof v !== "object")
      .map(([k, v]) => [k, typeof v === "number" ? v : String(v)])
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stellartools-signature") ?? "";

  try {
    wh.constructEvent(rawBody, signature, process.env.WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, settings }: { event: WebhookEvent; settings: Settings } = JSON.parse(rawBody);

  const resend = new Resend(settings.resendApiKey);
  const { data: domainData } = await resend.domains.list();
  console.log("domainData", domainData);
  const verifiedDomain = domainData?.data?.find((d) => d.status === "verified");
  const from = verifiedDomain ? `odii@${verifiedDomain.name}` : "onboarding@resend.dev";
  const customerEmail = (event.data.object as unknown as Record<string, unknown>).customer_email as string | undefined;
  const environment = event.livemode ? "mainnet" : "testnet";

  switch (event.type) {
    case "payment.confirmed": {
      if (!settings.paymentReceivedTemplateId || !customerEmail) break;
      await resend.emails.send({
        tags: [{ name: "source", value: `stellartools_${environment}` }],
        from,
        to: customerEmail,
        template: { id: settings.paymentReceivedTemplateId, variables: toVariables(event.data.object) },
      });
      break;
    }

    case "payment.failed": {
      if (!settings.paymentFailedTemplateId || !customerEmail) break;
      await resend.emails.send({
        tags: [{ name: "source", value: `stellartools_${environment}` }],
        from,
        to: customerEmail,
        template: { id: settings.paymentFailedTemplateId, variables: toVariables(event.data.object) },
      });
      break;
    }

    case "refund.succeeded": {
      if (!settings.refundSucceededTemplateId || !customerEmail) break;
      await resend.emails.send({
        tags: [{ name: "source", value: `stellartools_${environment}` }],
        from,
        to: customerEmail,
        template: { id: settings.refundSucceededTemplateId, variables: toVariables(event.data.object) },
      });
      break;
    }

    case "subscription.created": {
      if (!settings.subscriptionCreatedTemplateId || !customerEmail) break;
      await resend.emails.send({
        tags: [{ name: "source", value: `stellartools_${environment}` }],
        from,
        to: customerEmail,
        template: { id: settings.subscriptionCreatedTemplateId, variables: toVariables(event.data.object) },
      });
      break;
    }

    case "subscription.canceled": {
      if (!settings.subscriptionCanceledTemplateId || !customerEmail) break;
      await resend.emails.send({
        tags: [{ name: "source", value: `stellartools_${environment}` }],
        from,
        to: customerEmail,
        template: { id: settings.subscriptionCanceledTemplateId, variables: toVariables(event.data.object) },
      });
      break;
    }

    case "customer.created": {
      const { email, name } = event.data.object;
      console.log("email", email);
      console.log("name", name);
      console.log("from", from);
      await Promise.allSettled([
        settings.customerSyncEnabled && settings.segmentId
          ? resend.contacts.create({
              email,
              firstName: name,
              unsubscribed: false,
              segments: [{ id: settings.segmentId }],
            })
          : null,
        settings.customerWelcomeTemplateId
          ? resend.emails.send({
              tags: [{ name: "source", value: `stellartools_${environment}` }],
              from,
              to: email,
              template: { id: settings.customerWelcomeTemplateId, variables: toVariables(event.data.object) },
            })
          : null,
      ]);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
