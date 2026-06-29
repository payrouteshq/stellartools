import { Session } from "@shopify/shopify-app-remix/server";
import { eq, inArray } from "drizzle-orm";
import { db, shopifySessions } from "~/db.server";

// Minimal interface matching what shopifyApp() expects for sessionStorage
export interface SessionStorage {
  storeSession(session: Session): Promise<boolean>;
  loadSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;
  deleteSessions(ids: string[]): Promise<boolean>;
  findSessionsByShop(shop: string): Promise<Session[]>;
}

export class DrizzleSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const row = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope ?? null,
      expires: session.expires ?? null,
      accessToken: session.accessToken ?? null,
      userId: (session.onlineAccessInfo?.associated_user?.id ?? null)?.toString() ?? null,
      firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
      lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
      email: session.onlineAccessInfo?.associated_user?.email ?? null,
      accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? false,
      locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
      collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? false,
      emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? false,
    };

    await db
      .insert(shopifySessions)
      .values(row)
      .onConflictDoUpdate({ target: shopifySessions.id, set: row });

    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const [row] = await db
      .select()
      .from(shopifySessions)
      .where(eq(shopifySessions.id, id))
      .limit(1);

    return row ? this.rowToSession(row) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length) {
      await db.delete(shopifySessions).where(inArray(shopifySessions.id, ids));
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await db
      .select()
      .from(shopifySessions)
      .where(eq(shopifySessions.shop, shop));
    return rows.map((r) => this.rowToSession(r));
  }

  private rowToSession(row: typeof shopifySessions.$inferSelect): Session {
    const session = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
    });
    if (row.scope) session.scope = row.scope;
    if (row.expires) session.expires = row.expires;
    if (row.accessToken) session.accessToken = row.accessToken;
    return session;
  }
}
