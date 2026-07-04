import { putPayment, retrievePayments } from "@/actions/payment";
import { Network } from "@/db";
import { retrieveTransaction } from "@/integrations/stellar-core";

export async function resolvePublicPayments(orgId: string, env: Network, filters: any) {
  const { data: rawPayments, has_more } = await retrievePayments(orgId, env, filters, {
    withCustomer: true,
    withWallets: true,
    withRefunds: true,
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
    const { customer, wallets, refunds } = p;

    return {
      id: p.id,
      checkoutId: p.checkoutId,
      customerId: p.customerId,
      subscriptionId: p.subscriptionId ?? null,
      amount: `${p.cryptoAmount} ${p.selectedAssetCode}`,
      status: p.status,
      transactionHash: p.transactionHash,
      createdAt: p.createdAt,
      metadata: p.metadata ?? null,
      currencyCode: p.currencyCode,
      amountCents: p.amountCents,
      selectedAssetCode: p.selectedAssetCode,
      selectedAssetIssuer: p.selectedAssetIssuer ?? "",
      billingDetails: customer ? { email: customer.email, name: customer.name } : null,
      paymentMethodDetails: wallets ? { id: wallets.id, address: wallets.address } : null,
      lineItems: refunds
        ? [
            {
              id: refunds.id,
              amount: `${refunds.cryptoAmount} ${refunds.selectedAssetCode}`,
              reason: refunds.reason,
              status: refunds.status,
            },
          ]
        : [],
    };
  });

  return { data: mapped, has_more };
}
