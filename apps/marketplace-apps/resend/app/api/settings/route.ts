import { verifyJwt } from "@stellartools/core";
import { stellarFetch } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type AppTokenPayload = { instId: string; orgId: string; scopes: string[]; env: string; settings: Record<string, unknown> };

function getAppToken(req: NextRequest) {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

async function testConnection(apiKey: string): Promise<boolean> {
  const resend = new Resend(apiKey);
  const { error } = await resend.domains.list();
  return !error;
}

async function resolveSegmentId(apiKey: string): Promise<string> {
  const resend = new Resend(apiKey);
  const { data } = await resend.segments.list();
  const existing = data?.data?.find((s) => s.name === "StellarTools");
  if (existing) return existing.id;
  const { data: created } = await resend.segments.create({ name: "StellarTools" });
  return created!.id;
}

async function resolveFromEmail(apiKey: string): Promise<string> {
  const resend = new Resend(apiKey);
  const { data } = await resend.domains.list();
  const verified = data?.data?.find((d) => d.status === "verified");
  return verified ? `noreply@${verified.name}` : "onboarding@resend.dev";
}

export async function POST(req: NextRequest) {
  const appToken = getAppToken(req);
  if (!appToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: AppTokenPayload;
  try { payload = verifyJwt<AppTokenPayload>(appToken); }
  catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

  const { instId } = payload;

  const patch = await req.json().catch(() => null);
  if (!patch) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  if (patch.resendApiKey) {
    const connected = await testConnection(patch.resendApiKey);
    if (!connected) return NextResponse.json({ error: "Could not connect to Resend. Check your API key." }, { status: 422 });

    const [fromEmail, segmentId] = await Promise.all([
      resolveFromEmail(patch.resendApiKey),
      resolveSegmentId(patch.resendApiKey),
    ]);
    patch.fromEmail = fromEmail;
    patch.segmentId = segmentId;
  }

  const res = await stellarFetch(
    `/installations/${instId}/settings`,
    appToken,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to save settings" }));
    return NextResponse.json(err, { status: res.status });
  }

  const { resendApiKey, ...rest } = await res.json();
  return NextResponse.json({ ...rest, hasApiKey: Boolean(resendApiKey) });
}
