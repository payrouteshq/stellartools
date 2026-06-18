import { verifyJwt } from "@stellartools/app-embed-bridge/server";
import { stellarFetch } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

type AppTokenPayload = { instId: string; orgId: string; scopes: string[]; env: string; settings: Record<string, unknown> };

function getAppToken(req: NextRequest) {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function GET(req: NextRequest) {
  const appToken = getAppToken(req);
  if (!appToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: AppTokenPayload;
  try { payload = verifyJwt<AppTokenPayload>(appToken); }
  catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

  const { instId } = payload;

  const res = await stellarFetch(`/installations/${instId}/settings`, appToken);

  if (res.status === 404) return NextResponse.json({ installationId: instId, hasApiKey: false, sendReceiptOnPayment: false });
  if (!res.ok) return NextResponse.json({ error: "Failed to load settings" }, { status: res.status });

  const { resendApiKey, ...rest } = await res.json();
  return NextResponse.json({ ...rest, hasApiKey: Boolean(resendApiKey) });
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

  if (patch.resendApiKey && !/^re_[a-zA-Z0-9_]{10,}$/.test(patch.resendApiKey)) {
    return NextResponse.json({ error: "Invalid Resend API key format" }, { status: 422 });
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
