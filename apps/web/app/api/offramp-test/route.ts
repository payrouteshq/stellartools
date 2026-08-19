import { getAnchorConfig, supportedFiatCurrencySchema } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { validateFundingInstructions } from "@/integrations/anchor/funding";
import { authenticateWithSep10 } from "@/integrations/anchor/sep10";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { Sep38Client } from "@/integrations/anchor/sep38";
import { prepareAssetPayment, submitPreparedAssetPayment } from "@/integrations/stellar-core";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const initiateSchema = z.object({
  action: z.literal("initiate").optional(),
  assetCode: z.string().min(1),
  amount: z.string().min(1),
  destinationCurrency: supportedFiatCurrencySchema,
  destinationCountry: z.string().length(2),
});

const fundSchema = z.object({
  action: z.literal("fund"),
  transactionId: z.string().min(1),
  assetCode: z.string().min(1),
  requestedAmount: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const testSecret = process.env.OFFRAMP_TEST_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "OFFRAMP_TEST_SECRET env var not set" }, { status: 500 });
  }

  const transactionId = request.nextUrl.searchParams.get("id");
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transaction id parameter" }, { status: 400 });
  }

  try {
    const config = getAnchorConfig("testnet");
    const toml = await discoverAnchor(config);
    const token = await authenticateWithSep10({ config, toml, accountSecret: testSecret });
    const sep24 = new Sep24Client(config, toml, token);
    const transaction = await sep24.getTransaction(transactionId);

    return NextResponse.json({
      transactionId: transaction.id,
      status: transaction.status,
      kind: transaction.kind,
      amountIn: transaction.amount_in,
      amountOut: transaction.amount_out,
      withdrawAnchorAccount: transaction.withdraw_anchor_account,
      withdrawMemo: transaction.withdraw_memo,
      requiresFunding: transaction.status === "pending_user_transfer_start",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch transaction status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const testSecret = process.env.OFFRAMP_TEST_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "OFFRAMP_TEST_SECRET env var not set" }, { status: 500 });
  }

  const body = await request.json();

  if (body.action === "fund") {
    const parsed = fundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { transactionId, assetCode, requestedAmount } = parsed.data;
    try {
      const config = getAnchorConfig("testnet");
      const toml = await discoverAnchor(config);
      const token = await authenticateWithSep10({ config, toml, accountSecret: testSecret });
      const sep24 = new Sep24Client(config, toml, token);
      const transaction = await sep24.getTransaction(transactionId);

      const asset = config.withdrawAssets.find((a) => a.code === assetCode);
      if (!asset) {
        return NextResponse.json({ error: `Asset ${assetCode} not configured` }, { status: 400 });
      }

      const instructions = validateFundingInstructions({
        transaction,
        requestedAmount,
        asset,
      });

      const prepared = await prepareAssetPayment({
        sourceSecret: testSecret,
        destination: instructions.destination,
        assetCode: asset.code,
        assetIssuer: asset.issuer ?? "",
        amount: instructions.amount,
        network: "testnet",
        memo: instructions.memo,
      });

      const submitted = await submitPreparedAssetPayment(prepared.transactionXdr, "testnet");

      return NextResponse.json({
        funded: true,
        hash: submitted.hash,
        status: transaction.status,
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Funding payment failed" },
        { status: 500 }
      );
    }
  }

  const parsed = initiateSchema.safeParse(body);
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
