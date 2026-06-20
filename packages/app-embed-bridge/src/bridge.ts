import { Network as StellarToolsNetwork } from "@stellartools/core";

/** Host typography for embedded apps — applied automatically by stellar.init(). */
export const STELLAR_EMBED_FONT = '"DM Sans", sans-serif';

export type BridgeContext = {
  organizationId: string;
  environment: StellarToolsNetwork;
  pathname: string;
  theme: "light" | "dark";
  installationId: string;
  scopes: string[];
  appToken: string;
};

const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";

function applyHostFont() {
  if (document.querySelector("[data-stellar-font]")) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_STYLESHEET;
  link.dataset.stellarFont = "true";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.dataset.stellarFont = "true";
  style.textContent = `html,body{font-family:${STELLAR_EMBED_FONT}!important}`;
  document.head.appendChild(style);
}

export const stellar = {
  init: (onUpdate?: (context: Partial<BridgeContext>) => void) => {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);
    const context: BridgeContext = {
      organizationId: params.get("orgId")!,
      environment: params.get("env") as StellarToolsNetwork,
      pathname: params.get("pathname")!,
      theme: params.get("theme") as "light" | "dark",
      installationId: params.get("instId")!,
      scopes: params.get("scopes")?.split(",").filter(Boolean) ?? [],
      appToken: params.get("appToken")!,
    };

    if (context.installationId) applyHostFont();

    const observer = new ResizeObserver((entries) => {
      window.parent.postMessage({ type: "stellar:resize", payload: { height: entries[0].contentRect.height } }, "*");
    });
    observer.observe(document.body);

    window.addEventListener("message", (event) => {
      if (event.data?.type === "stellar:context_update") onUpdate?.(event.data.payload);
    });

    return context;
  },

  navigate: (url: string) => {
    window.parent.postMessage({ type: "stellar:navigate", payload: { url } }, "*");
  },

  reload: () => {
    window.parent.postMessage({ type: "stellar:reload" }, "*");
  },
};

/**
 * Creates an authenticated fetch bound to the app's BFF.
 * Every request automatically carries the appToken as a Bearer header.
 *
 * Usage: const apiFetch = createBridgeFetch(bridge.appToken);
 *        await apiFetch("/api/settings", { method: "POST", body: ... });
 */
export function createBridgeFetch(appToken: string) {
  return (path: string, init?: RequestInit): Promise<Response> =>
    fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${appToken}` },
    });
}
