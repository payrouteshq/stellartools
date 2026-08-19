import "server-only";

import { AssetCode, Network } from "@/constant/schema.client";
import { z } from "zod";

export const supportedFiatCurrencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Za-z]{3}$/)
  .transform((val) => val.toUpperCase());
export type SupportedFiatCurrency = string;

export const supportedPayoutRailSchema = z.enum(["bank_account", "mobile_money", "paypal", "cash_pickup", "card_transfer"]);
export type SupportedPayoutRail = z.infer<typeof supportedPayoutRailSchema>;

export const anchorIdSchema = z.enum(["sdf-test-anchor"]);
export type AnchorId = z.infer<typeof anchorIdSchema>;

export interface AnchorAssetConfig {
  code: AssetCode;
  issuer: string | null;
  sep24Code?: string;
}

export interface AnchorConfig {
  id: AnchorId;
  displayName: string;
  domain: string;
  network: Network;
  withdrawAssets: readonly AnchorAssetConfig[];
  discoveryFallback?: {
    transferServerSep24: string;
    webAuthEndpoint: string;
    signingKey: string;
    anchorQuoteServer?: string;
  };
  capabilitiesFallback?: Readonly<Record<string, { enabled: boolean; min_amount: string; max_amount: string }>>;
  destinationCurrenciesFallback?: readonly SupportedFiatCurrency[];
}

type AnchorRegistry = Readonly<Partial<Record<Network, Partial<Record<AnchorId, AnchorConfig>>>>>;

const SDF_TEST_ASSETS = [
  { code: "XLM", issuer: null, sep24Code: "native" },
  {
    code: "SRT",
    issuer: "GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B",
  },
  {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
] as const satisfies readonly AnchorAssetConfig[];

const ANCHOR_REGISTRY: AnchorRegistry = {
  testnet: {
    "sdf-test-anchor": {
      id: "sdf-test-anchor",
      displayName: "SDF Test Anchor",
      domain: "testanchor.stellar.org",
      network: "testnet",
      withdrawAssets: SDF_TEST_ASSETS,
      discoveryFallback: {
        transferServerSep24: "https://testanchor.stellar.org/sep24",
        webAuthEndpoint: "https://testanchor.stellar.org/auth",
        signingKey: "GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR",
        anchorQuoteServer: "https://testanchor.stellar.org/sep38",
      },
      capabilitiesFallback: {
        native: { enabled: true, min_amount: "1", max_amount: "10" },
        SRT: { enabled: true, min_amount: "1", max_amount: "10" },
        USDC: { enabled: true, min_amount: "1", max_amount: "10" },
      },
      destinationCurrenciesFallback: ["USD"],
    },
  },
};

export function getAnchorConfig(network: Network, rawAnchorId?: string): AnchorConfig {
  if (network === "mainnet") {
    throw new Error("Fiat offramp payouts are currently only available on Testnet");
  }

  const defaultId = network === "testnet" ? "sdf-test-anchor" : undefined;
  const parsedId = anchorIdSchema.safeParse(rawAnchorId ?? defaultId);

  if (!parsedId.success) {
    throw new Error(`No valid offramp anchor is configured for ${network}`);
  }

  const config = ANCHOR_REGISTRY[network]?.[parsedId.data];
  if (!config) throw new Error(`Anchor ${parsedId.data} is not available on ${network}`);

  if (parsedId.data === "sdf-test-anchor" && process.env.SDF_TEST_ANCHOR_DOMAIN) {
    const domain = process.env.SDF_TEST_ANCHOR_DOMAIN;
    return {
      ...config,
      domain,
      discoveryFallback: {
        transferServerSep24: `https://${domain}/sep24`,
        webAuthEndpoint: `https://${domain}/auth`,
        signingKey: config.discoveryFallback?.signingKey ?? "GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR",
        anchorQuoteServer: `https://${domain}/sep38`,
      },
    };
  }

  return config;
}
