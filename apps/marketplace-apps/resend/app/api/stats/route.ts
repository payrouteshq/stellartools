import { stellarFetch } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const TERMINAL = new Set([
  "delivered",
  "opened",
  "clicked",
  "complained",
  "bounced",
  "failed",
  "suppressed",
  "canceled",
]);
const DELIVERED = new Set(["delivered", "opened", "clicked", "complained"]);
const BOUNCED = new Set(["bounced", "failed", "suppressed"]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const installationId = searchParams.get("installationId");
  const organizationId = searchParams.get("organizationId");
  const environment = searchParams.get("environment");
  const scopes = searchParams.get("scopes")?.split(",").filter(Boolean) ?? [];

  if (!installationId || !organizationId || !environment) {
    return NextResponse.json({ error: "installationId, organizationId and environment are required" }, { status: 400 });
  }

  const settingsRes = await stellarFetch(
    `/installations/${installationId}/settings`,
    { orgId: organizationId, instId: installationId, scopes, env: environment }
  );

  if (!settingsRes.ok) return NextResponse.json({ error: "Failed to load settings" }, { status: settingsRes.status });

  const settings = await settingsRes.json();
  if (!settings.resendApiKey) return NextResponse.json({ error: "No API key configured" }, { status: 404 });

  const resend = new Resend(settings.resendApiKey);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  type EmailItem = NonNullable<Awaited<ReturnType<typeof resend.emails.list>>["data"]>["data"][number];
  const allEmails: EmailItem[] = [];

  let cursor: string | undefined;

  while (true) {
    const { data: list, error } = await resend.emails.list({ limit: 100, ...(cursor ? { after: cursor } : {}) });

    if (error || !list) break;

    const inWindow = list.data.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    allEmails.push(...inWindow);

    if (!list.has_more || inWindow.length < list.data.length) break;

    cursor = list.data[list.data.length - 1]?.id;
    if (!cursor) break;
  }

  const now = Date.now();
  const terminal = allEmails.filter((e) => TERMINAL.has(e.last_event));
  const delivered = terminal.filter((e) => DELIVERED.has(e.last_event)).length;
  const bounced = terminal.filter((e) => BOUNCED.has(e.last_event)).length;
  const t = terminal.length;

  const daily = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, sent: 0 }));
  for (const email of allEmails) {
    const idx = 29 - Math.floor((now - new Date(email.created_at).getTime()) / (24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < 30) daily[idx].sent++;
  }

  return NextResponse.json({
    totalSent: allEmails.length,
    deliveredRate: t > 0 ? `${((delivered / t) * 100).toFixed(1)}%` : "—",
    bounceRate: t > 0 ? `${((bounced / t) * 100).toFixed(1)}%` : "—",
    daily,
    emails: allEmails.map((e) => ({
      id: e.id,
      to: e.to[0],
      subject: e.subject,
      status: e.last_event,
      sentAt: new Date(e.created_at).toLocaleString(),
    })),
  });
}
