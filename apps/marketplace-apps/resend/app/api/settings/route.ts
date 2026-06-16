import { stellarFetch } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const installationId = searchParams.get("installationId");
  const organizationId = searchParams.get("organizationId");
  const environment = searchParams.get("environment");
  const scopes = searchParams.get("scopes")?.split(",").filter(Boolean) ?? [];

  if (!installationId || !organizationId || !environment) {
    return NextResponse.json({ error: "installationId, organizationId and environment are required" }, { status: 400 });
  }

  const res = await stellarFetch(
    `/installations/${installationId}/settings`,
    { orgId: organizationId, instId: installationId, scopes, env: environment }
  );

  if (res.status === 404) return NextResponse.json({ installationId, hasApiKey: false, sendReceiptOnPayment: false });
  if (!res.ok) return NextResponse.json({ error: "Failed to load settings" }, { status: res.status });

  const { resendApiKey, ...rest } = await res.json();
  return NextResponse.json({ ...rest, hasApiKey: Boolean(resendApiKey) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { installationId, organizationId, environment, scopes, ...patch } = body ?? {};

  if (!installationId || !organizationId || !environment) {
    return NextResponse.json({ error: "installationId, organizationId and environment are required" }, { status: 400 });
  }

  if (patch.resendApiKey && !/^re_[a-zA-Z0-9_]{10,}$/.test(patch.resendApiKey)) {
    return NextResponse.json({ error: "Invalid Resend API key format" }, { status: 422 });
  }

  const res = await stellarFetch(
    `/installations/${installationId}/settings`,
    { orgId: organizationId, instId: installationId, scopes: scopes ?? [], env: environment },
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to save settings" }));
    return NextResponse.json(err, { status: res.status });
  }

  const { resendApiKey, ...rest } = await res.json();
  return NextResponse.json({ ...rest, hasApiKey: Boolean(resendApiKey) });
}
