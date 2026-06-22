import { stellarFetch } from "@/lib/utils";
import { verifyJwt } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type AppTokenPayload = {
  instId: string;
  orgId: string;
  scopes: string[];
  env: string;
  settings: Record<string, unknown>;
};

function getAppToken(req: NextRequest) {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

async function testConnection(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const resend = new Resend(apiKey);
  const { error } = await resend.domains.list();
  if (!error) return { ok: true };
  return { ok: false, message: error.message };
}

const SEGMENT_NAME: Record<string, string> = {
  mainnet: "StellarTools (Live)",
  testnet: "StellarTools (Test)",
};

async function resolveSegmentId(apiKey: string, env: string): Promise<string> {
  const name = SEGMENT_NAME[env] ?? "StellarTools";
  const resend = new Resend(apiKey);
  const { data } = await resend.segments.list();
  const existing = data?.data?.find((s) => s.name === name);
  if (existing) return existing.id;
  const { data: created } = await resend.segments.create({ name });
  return created!.id;
}

async function resolveFromEmail(apiKey: string): Promise<string> {
  const resend = new Resend(apiKey);
  const { data } = await resend.domains.list();
  const verified = data?.data?.find((d) => d.status === "verified");
  console.log("verified", verified);
  return verified ? `odii@${verified.name}` : "onboarding@resend.dev";
}

export async function POST(req: NextRequest) {
  const appToken = getAppToken(req);
  if (!appToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: AppTokenPayload;
  try {
    payload = verifyJwt<AppTokenPayload>(appToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { instId, env } = payload;

  const patch = await req.json().catch(() => null);
  if (!patch) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  if (patch.resendApiKey) {
    const connection = await testConnection(patch.resendApiKey);
    if (!connection.ok) return NextResponse.json({ error: connection.message }, { status: 422 });

    const [fromEmail, segmentId] = await Promise.all([
      resolveFromEmail(patch.resendApiKey),
      resolveSegmentId(patch.resendApiKey, env),
    ]);
    patch.fromEmail = fromEmail;
    patch.segmentId = segmentId;
  }

  const res = await stellarFetch(`/installations/${instId}/settings`, appToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to save settings" }));
    return NextResponse.json(err, { status: res.status });
  }

  const { resendApiKey, ...rest } = await res.json();
  return NextResponse.json({ ...rest, hasApiKey: Boolean(resendApiKey) });
}
