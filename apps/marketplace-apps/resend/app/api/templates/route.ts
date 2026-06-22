import { verifyJwt } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type AppTokenPayload = { settings: Record<string, unknown> };

export async function GET(req: NextRequest) {
  const appToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!appToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: AppTokenPayload;
  try {
    payload = verifyJwt<AppTokenPayload>(appToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const resendApiKey = payload.settings?.resendApiKey as string | undefined;
  if (!resendApiKey) return NextResponse.json({ error: "No API key configured" }, { status: 404 });

  const resend = new Resend(resendApiKey);
  const { data, error } = await resend.templates.list();

  if (error) return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });

  return NextResponse.json({
    templates: (data?.data ?? []).map((t) => ({ id: t.id, name: t.name })),
  });
}
