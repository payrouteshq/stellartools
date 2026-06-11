import { db, shopifySessions, apiKeys } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function verifyInternalAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "shop param required" }, { status: 400 });

  const [session] = await db
    .select({ organizationId: shopifySessions.organizationId })
    .from(shopifySessions)
    .where(and(eq(shopifySessions.shop, shop), isNotNull(shopifySessions.organizationId)))
    .limit(1);

  if (!session?.organizationId) {
    return NextResponse.json({ error: "Shop not connected to any organization" }, { status: 404 });
  }

  const [key] = await db
    .select({ token: apiKeys.token })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.organizationId, session.organizationId),
        eq(apiKeys.isRevoked, false)
      )
    )
    .limit(1);

  if (!key?.token) {
    return NextResponse.json({ error: "No active API key found for organization" }, { status: 404 });
  }

  return NextResponse.json({ apiKey: key.token });
}
