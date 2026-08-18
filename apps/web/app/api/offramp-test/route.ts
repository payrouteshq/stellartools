import { getAnchorConfig, supportedFiatCurrencySchema } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { Sep38Client } from "@/integrations/anchor/sep38";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  assetCode: z.string().min(1),
  amount: z.string().min(1),
  destinationCurrency: supportedFiatCurrencySchema,
  destinationCountry: z.string().length(2),
});

export async function POST(request: NextRequest) {
  const testSecret = process.env.OFFRAMP_TEST_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "OFFRAMP_TEST_SECRET env var not set" }, { status: 500 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { assetCode, amount, destinationCurrency, destinationCountry } = parsed.data;
  const config = getAnchorConfig("testnet");
  const toml = await discoverAnchor(config);
  const token = await authenticateWithSep10({ config, toml, accountSecret: testSecret });
  const sep24 = new Sep24Client(config, toml, token);

  const asset = config.withdrawAssets.find((a) => a.code === assetCode);
  if (!asset) {
    return NextResponse.json({ error: `Asset ${assetCode} not configured` }, { status: 400 });
  }

  let quote = null;
  if (toml.ANCHOR_QUOTE_SERVER) {
    const sellAsset = asset.issuer ? `stellar:${asset.code}:${asset.issuer}` : "stellar:native";
    const buyAsset = `iso4217:${destinationCurrency}`;
    quote = await new Sep38Client(config, toml, token).createQuote({
      sellAsset,
      buyAsset,
      sellAmount: amount,
      countryCode: destinationCountry,
    });
  }

  const interactive = await sep24.initiateWithdrawal({
    assetCode: asset.sep24Code ?? asset.code,
    assetIssuer: asset.issuer ?? undefined,
    amount: quote?.sell_amount ?? amount,
    quoteId: quote?.id,
    destinationAsset: quote?.buy_asset,
  });

  return NextResponse.json({
    interactiveUrl: interactive.url,
    transactionId: interactive.id,
    quote: quote
      ? {
          id: quote.id,
          sell_amount: quote.sell_amount,
          buy_amount: quote.buy_amount,
          buy_asset: quote.buy_asset,
          expires_at: quote.expires_at,
        }
      : null,
  });
}
