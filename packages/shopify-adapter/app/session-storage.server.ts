import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

const base = () => {
  const url = process.env.STELLAR_TOOLS_API_URL;
  if (!url) throw new Error("STELLAR_TOOLS_API_URL is not set");
  return url;
};

const authHeader = () => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET is not set");
  return { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
};

function toSession(raw: Record<string, unknown>): Session {
  const s = new Session({
    id: raw.id as string,
    shop: raw.shop as string,
    state: (raw.state as string) ?? "",
    isOnline: (raw.isOnline as boolean) ?? false,
  });
  if (raw.scope) s.scope = raw.scope as string;
  if (raw.expires) s.expires = new Date(raw.expires as string);
  if (raw.accessToken) s.accessToken = raw.accessToken as string;
  return s;
}

export class RemoteSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const res = await fetch(`${base()}/shopify/sessions`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires?.toISOString() ?? null,
        accessToken: session.accessToken ?? "",
      }),
    });
    return res.ok;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const res = await fetch(`${base()}/shopify/sessions/${encodeURIComponent(id)}`, {
      headers: authHeader(),
    });
    if (res.status === 404) return undefined;
    if (!res.ok) return undefined;
    const raw = await res.json();
    if (!raw) return undefined;
    return toSession(raw);
  }

  async deleteSession(id: string): Promise<boolean> {
    const res = await fetch(`${base()}/shopify/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    return res.ok;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    const results = await Promise.all(ids.map((id) => this.deleteSession(id)));
    return results.every(Boolean);
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const res = await fetch(`${base()}/shopify/sessions?shop=${encodeURIComponent(shop)}`, {
      headers: authHeader(),
    });
    if (!res.ok) return [];
    const rows: Record<string, unknown>[] = await res.json();
    return rows.map(toSession);
  }
}
