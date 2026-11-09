import type { Network } from "@/db";

export function getUsdcIssuers(environment: Network): string[] {
  const raw =
    (environment === "testnet"
      ? process.env.NEXT_PUBLIC_USDC_ISSUERS_TESTNET
      : process.env.NEXT_PUBLIC_USDC_ISSUERS_MAINNET) ?? "";

  return raw
    .split(",")
    .map((issuer) => issuer.trim())
    .filter(Boolean);
}
