import { db, shopifySessions } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function verifyInternalAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function POST(req: NextRequest) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const data = await req.json();

  await db
    .insert(shopifySessions)
    .values({
      id: data.id,
      shop: data.shop,
      state: data.state ?? "",
      isOnline: data.isOnline ?? false,
      scope: data.scope ?? null,
      expires: data.expires ? new Date(data.expires) : null,
      accessToken: data.accessToken,
    })
    .onConflictDoUpdate({
      target: shopifySessions.id,
      set: {
        shop: data.shop,
        state: data.state ?? "",
        isOnline: data.isOnline ?? false,
        scope: data.scope ?? null,
        expires: data.expires ? new Date(data.expires) : null,
        accessToken: data.accessToken
      },
    });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "shop param required" }, { status: 400 });

  const rows = await db
    .select()
    .from(shopifySessions)
    .where(eq(shopifySessions.shop, shop));

  return NextResponse.json(rows.map(serializeSession));
}

function serializeSession(row: typeof shopifySessions.$inferSelect) {
  return { ...row };
}
