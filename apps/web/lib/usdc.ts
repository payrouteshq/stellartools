import type { Network } from "@/db";

export function getUsdcIssuer(environment: Network): string {
  return environment === "testnet"
    ? process.env.NEXT_PUBLIC_USDC_ISSUER_TESTNET!
    : process.env.NEXT_PUBLIC_USDC_ISSUER_MAINNET!;
}

export const USDC_METADATA = { usdPeg: true } as const;

export function getUsdcAsset(environment: Network) {
  return {
    code: "USDC" as const,
    canonicalIssuer: getUsdcIssuer(environment),
    metadata: USDC_METADATA,
  };
}
