import { putPayment, retrievePayments } from "@/actions/payment";
import { Network } from "@/db";
import { retrieveTransaction } from "@/integrations/stellar-core";

export async function resolvePublicPayments(orgId: string, env: Network, filters: any) {
  const { data: rawPayments, has_more } = await retrievePayments(orgId, env, filters, {
    withCustomer: true,
    withWallets: true,
    withRefunds: true,
    withAsset: true,
  });

  const reconciledPayments = await Promise.all(
    rawPayments.map(async (p) => {
      if (p.status !== "pending") return p;

      const txResult = await retrieveTransaction(p.transactionHash, env);
      
      if (txResult.isErr() || !txResult.value) return p;

      const newStatus = txResult.value.successful ? "confirmed" : "failed";

      await putPayment(p.id, orgId, env, { status: newStatus });

      return { ...p, status: newStatus };
    })
  );

  const mapped = reconciledPayments.map((p) => {
    const { customer, wallets, refunds, asset, ...rest } = p;

    return {
      ...rest,
      amount: `${p.amount} ${asset?.code ?? "XLM"}`,
      billing_details: customer ? { email: customer.email, name: customer.name } : null,
      payment_method_details: wallets ? { id: wallets.id, address: wallets.address } : null,
      line_items: refunds
        ? [
            {
              id: refunds.id,
              amount: `${refunds.amount} ${refunds.assetCode}`,
              reason: refunds.reason,
              status: refunds.status,
            },
          ]
        : [],
    };
  });

  return { data: mapped, has_more };
}
