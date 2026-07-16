import { deleteCookies } from "@/integrations/cookie-manager";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const keys = (req.nextUrl.searchParams.get("keys") ?? "").split(",").map((key) => key.trim());

  if (keys.length) await deleteCookies(keys);

  return NextResponse.json({ success: true, cleared: keys });
}
