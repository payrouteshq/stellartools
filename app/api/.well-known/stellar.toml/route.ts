import { retrieveSupportedAssets } from "@/actions/asset";
import TOML from "@iarna/toml";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

// todo: figure out how to switch environment
export const GET = async (request: NextRequest) => {
  console.log("getting stellar.toml");
  const environment = "testnet";

  const assets = await retrieveSupportedAssets(null, environment);

  const toml = TOML.stringify({
    NETWORK_PASSPHRASE: environment === "testnet" ? TESTNET_PASSPHRASE : MAINNET_PASSPHRASE,
    URI_REQUEST_SIGNING_KEY: process.env.KEEPER_PUBLIC_KEY!,
    CURRENCIES: assets
      .map(
        (asset) =>
          `{ code: "${asset.code}", native: ${asset.code === "XLM" ? true : false}, issuers: "${asset.issuers?.join(",")}" }`
      )
      .join("\n"),
  });

  return new NextResponse(toml, {
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
