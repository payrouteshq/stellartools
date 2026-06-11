import { db, appInstallations, shopifySessions, apiKeys } from "@/db";
import { and, eq } from "drizzle-orm";
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

  const body = await req.json();
  const { shop, apiKey, environment = "mainnet", scopes = [] } = body as {
    shop: string;
    apiKey?: string;
    organizationId?: string;
    environment?: string;
    scopes?: string[];
  };
  let { organizationId } = body as { organizationId?: string };

  if (!shop) {
    return NextResponse.json({ error: "shop is required" }, { status: 400 });
  }

  // Resolve organizationId from apiKey if not provided directly
  if (!organizationId && apiKey) {
    const [keyRow] = await db
      .select({ organizationId: apiKeys.organizationId })
      .from(apiKeys)
      .where(and(eq(apiKeys.token, apiKey), eq(apiKeys.isRevoked, false)))
      .limit(1);

    if (!keyRow) {
      return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 400 });
    }
    organizationId = keyRow.organizationId;
  }

  if (!organizationId) {
    return NextResponse.json({ error: "Provide apiKey or organizationId." }, { status: 400 });
  }

  // Link all sessions for this shop to the organization
  await db
    .update(shopifySessions)
    .set({ organizationId })
    .where(eq(shopifySessions.shop, shop));

  // Upsert the appInstallations record
  const shopifyAppId = process.env.SHOPIFY_APP_DB_ID;
  if (shopifyAppId) {
    await db
      .insert(appInstallations)
      .values({
        id: `shopify_${organizationId}_${environment}`,
        appId: shopifyAppId,
        organizationId,
        environment: environment as "testnet" | "mainnet",
        scopes,
        status: "active",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [appInstallations.appId, appInstallations.organizationId, appInstallations.environment],
        set: { status: "active", scopes, updatedAt: new Date() },
      });
  }

  // Return the organization's first active API key so the adapter can create checkouts
  const [key] = await db
    .select({ token: apiKeys.token })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.organizationId, organizationId),
        eq(apiKeys.environment, environment as "testnet" | "mainnet"),
        eq(apiKeys.isRevoked, false)
      )
    )
    .limit(1);

  return NextResponse.json({ ok: true, apiKey: key?.token ?? null });
}

// DELETE /api/shopify/connect
// Body: { shop }
// Suspends the installation and clears all sessions for the shop (called on uninstall).
export async function DELETE(req: NextRequest) {
  if (!verifyInternalAuth(req)) return unauthorized();

  const { shop } = await req.json();
  if (!shop) return NextResponse.json({ error: "shop is required" }, { status: 400 });

  // Find organizationId from sessions
  const [session] = await db
    .select({ organizationId: shopifySessions.organizationId })
    .from(shopifySessions)
    .where(eq(shopifySessions.shop, shop))
    .limit(1);

  // Remove all sessions for this shop
  await db.delete(shopifySessions).where(eq(shopifySessions.shop, shop));

  // Suspend the installation if we have an org link
  const shopifyAppId = process.env.SHOPIFY_APP_DB_ID;
  if (shopifyAppId && session?.organizationId) {
    await db
      .update(appInstallations)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(
        and(
          eq(appInstallations.appId, shopifyAppId),
          eq(appInstallations.organizationId, session.organizationId)
        )
      );
  }

  return NextResponse.json({ ok: true });
}
