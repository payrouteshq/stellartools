import { postCreditTransaction, putCreditBalance, retrieveCreditBalance } from "@/actions/credit";
import { runAtomic } from "@/actions/event";
import { retrieveProducts } from "@/actions/product";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { calculateUsageToCredits } from "@/lib/credit-calculator";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["apikey"],
  schema: {
    params: Schema.object({ customer_id: Schema.string(), product_id: Schema.string() }),
    body: Schema.object({
      amount: Schema.number(), // Raw usage (e.g., 5000 tokens)
      type: Schema.enum(["deduct", "refund", "grant"]),
      reason: Schema.string().optional(),
      metadata: Schema.record(Schema.string(), Schema.any()).optional(),
      dry_run: Schema.boolean().optional(),
    }),
  },
  handler: async ({ params, body, auth }) => {
    const { customer_id, product_id } = params;
    const { organizationId, environment } = auth;

    const [productData, creditBalance] = await Promise.all([
      retrieveProducts(organizationId, environment, { productId: product_id }).then((res) => res[0]),
      retrieveCreditBalance(customer_id, product_id, organizationId),
    ]);

    if (!productData || !creditBalance) {
      throw new Error("Credit balance or product configuration not found");
    }

    if (creditBalance.isRevoked) {
      throw new Error("Credit balance has been revoked. Contact your provider to restore access.");
    }

    const requiredCredits = calculateUsageToCredits(body.amount, productData.product.unitsPerCredit ?? BigInt(1));

    const isSufficient = creditBalance.balance >= requiredCredits;

    if (body.dry_run) {
      return Result.ok({ is_sufficient: isSufficient, remaining_balance: creditBalance.balance });
    }

    if (body.type === "deduct" && !isSufficient) {
      throw new Error(`Insufficient credits: ${creditBalance.balance} < ${requiredCredits}`);
    }

    // 3. Calculate New Totals
    const delta = body.type === "deduct" ? -requiredCredits : requiredCredits;
    const newBalance = creditBalance.balance + delta;
    const newConsumed =
      body.type === "deduct"
        ? creditBalance.consumed + requiredCredits
        : body.type === "refund"
          ? creditBalance.consumed - requiredCredits
          : creditBalance.consumed;

    const newGranted = body.type === "grant" ? creditBalance.granted + requiredCredits : creditBalance.granted;

    const response = await runAtomic(async () => {
      const transaction = await postCreditTransaction(
        {
          customerId: customer_id,
          productId: product_id,
          balanceId: creditBalance.id,
          amount: requiredCredits,
          balanceBefore: creditBalance.balance,
          balanceAfter: newBalance,
          type: body.type,
          reason: body.reason ?? null,
          metadata: body.metadata ?? null,
        },
        organizationId,
        environment
      );

      const updatedBalance = await putCreditBalance(creditBalance.id, {
        balance: newBalance,
        consumed: newConsumed,
        granted: newGranted,
      });

      return { transaction, balance: updatedBalance };
    });

    return Result.ok({
      balance: response.balance.balance,
      billed_units: body.amount,
      credits_deducted: requiredCredits,
    });
  },
});
