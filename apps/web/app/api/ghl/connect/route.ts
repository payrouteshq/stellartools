import { NextRequest, NextResponse } from "next/server";

/** Same-origin proxy so the browser never talks cross-origin to the GHL marketplace app, and never holds `GHL_INTERNAL_API_SECRET`. */
export async function POST(req: NextRequest) {
  const res = await fetch(`${process.env.GHL_APP_BASE_URL}/api/connect-stellar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": process.env.GHL_INTERNAL_API_SECRET! },
    body: await req.text(),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
