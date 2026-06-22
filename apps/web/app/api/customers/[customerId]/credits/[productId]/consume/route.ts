import { putCreditBalance, retrieveCreditBalances } from "@/actions/credit";
import { getCorsHeaders } from "@/constant";
import { getMppxEngine } from "@/integrations/mppx-server";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const POST = apiHandler({
  auth: ["apikey"],
  schema: {
    params: Schema.object({ customerId: Schema.string(), productId: Schema.string() }),
    body: Schema.object({ amount: Schema.number() }),
  },
  handler: async ({ params, body, auth, req }) => {
    const {
      data: [balance],
    } = await retrieveCreditBalances(
      auth.organizationId,
      auth.environment,
      { customerId: params.customerId, productId: params.productId },
      { withProduct: true }
    );

    if (!balance || !balance.channelAddress) return Result.err(new Error("No active channel"));

    const engine = getMppxEngine({
      channelAddress: balance.channelAddress,
      commitmentPublicKey: balance.commitmentPublicKey!,
      network: balance.environment,
    });

    // Verify the 'Payment' header
    const result = await engine.channel({
      amount: body.amount.toString(),
      description: `Consumption: ${body.amount} units`,
    })(req);

    // 1. If no header or invalid -> Send 402 Challenge
    if (result.status === 402) {
      const challenge = result.challenge;
      return new Response(await challenge.text(), {
        status: 402,
        headers: {
          ...getCorsHeaders(req.headers.get("origin")),
          "WWW-Authenticate": challenge.headers.get("WWW-Authenticate")!,
        },
      });
    }

    // 2. If valid -> result.receipt contains the new signature
    const voucher = result.withReceipt.receipt.payload;

    // CRACKED: Single atomic update to save the latest proof of debt

    await putCreditBalance(
      balance.id,
      {
        latestCumulativeAmount: Number(voucher.amount),
        latestSignature: voucher.signature,
      },
      auth.organizationId,
      auth.environment
    );

    return Result.ok({
      success: true,
      remaining_balance: balance.product?.priceCents! - Number(voucher.amount),
    });
  },
});
