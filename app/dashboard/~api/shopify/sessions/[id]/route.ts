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

// GET /api/shopify/sessions/:id — load a session
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const { id } = await params;
  const [row] = await db
    .select()
    .from(shopifySessions)
    .where(eq(shopifySessions.id, id));

  if (!row) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(row);
}

// PATCH /api/shopify/sessions/:id — update fields (e.g. scope, organizationId)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const { id } = await params;
  const data = await req.json();

  await db
    .update(shopifySessions)
    .set(data)
    .where(eq(shopifySessions.id, id));

  return NextResponse.json({ ok: true });
}

// DELETE /api/shopify/sessions/:id — delete a session
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const { id } = await params;
  await db.delete(shopifySessions).where(eq(shopifySessions.id, id));

  return NextResponse.json({ ok: true });
}
