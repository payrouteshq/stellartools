import "server-only";

import { AnchorConfig } from "@/integrations/anchor/config";
import { assertAllowedEndpoint } from "@/integrations/anchor/http";
import { AnchorToml, anchorTomlSchema } from "@/integrations/anchor/schemas";
import { StellarToml } from "@stellar/stellar-sdk";

const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const discoveryCache = new Map<string, { expiresAt: number; toml: AnchorToml }>();
const pendingDiscoveries = new Map<string, Promise<AnchorToml>>();

export async function discoverAnchor(config: AnchorConfig): Promise<AnchorToml> {
  const cached = discoveryCache.get(config.domain);
  if (cached && cached.expiresAt > Date.now()) return cached.toml;

  const pending = pendingDiscoveries.get(config.domain);
  if (pending) return pending;

  const discovery = (async (): Promise<AnchorToml> => {
    const rawToml: unknown = await StellarToml.Resolver.resolve(config.domain, {
      allowHttp: false,
      timeout: 30_000,
      allowedRedirects: 0,
    });
    const toml = anchorTomlSchema.parse(rawToml);

    assertAllowedEndpoint(toml.TRANSFER_SERVER_SEP0024, config.domain);
    assertAllowedEndpoint(toml.WEB_AUTH_ENDPOINT, config.domain);
    if (toml.ANCHOR_QUOTE_SERVER) assertAllowedEndpoint(toml.ANCHOR_QUOTE_SERVER, config.domain);

    discoveryCache.set(config.domain, { toml, expiresAt: Date.now() + DISCOVERY_TTL_MS });
    return toml;
  })();

  pendingDiscoveries.set(config.domain, discovery);
  try {
    return await discovery;
  } finally {
    pendingDiscoveries.delete(config.domain);
  }
}
