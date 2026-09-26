import { Keypair } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  const orgUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stellartools.dev";

  const keeperPublicKey = process.env.KEEPER_SECRET_MAINNET
    ? Keypair.fromSecret(process.env.KEEPER_SECRET_MAINNET).publicKey()
    : undefined;

  const accounts = [process.env.CHARGES_PUBLIC_KEY_MAINNET, keeperPublicKey].filter(
    (account): account is string => !!account
  );

  const toml = [
    `VERSION="2.0.0"`,
    `NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"`,
    "",
    "[DOCUMENTATION]",
    `ORG_NAME="Stellar Tools"`,
    `ORG_URL="${orgUrl}"`,
    `ORG_SUPPORT_EMAIL="support@stellartools.dev"`,
    "",
    accounts.length ? `ACCOUNTS=[\n${accounts.map((a) => `  "${a}",`).join("\n")}\n]` : "ACCOUNTS=[]",
    "",
  ].join("\n");

  return new NextResponse(toml, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
