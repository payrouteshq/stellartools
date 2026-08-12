"use server";

import { retrieveSupportedAssets } from "@/actions/asset";
import { runAtomic } from "@/actions/event";
import { postPayment, retrievePayments } from "@/actions/payment";
import { putSubscription } from "@/actions/subscription";
import { STELLAR_PRECISION, subscriptionPeriodMs } from "@/constant";
import { customerWallets, customers, db, organizations, payments, products, subscriptions } from "@/db";
import { chargeSubscription as soroban$chargeSubscription } from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { and, desc, eq } from "drizzle-orm";

export type PublicSubscriptionInvoice = Awaited<ReturnType<typeof retrieveSubscriptionInvoice>>;

export const retrieveSubscriptionInvoice = async (token: string) => {
  const [row] = await db
    .select({
      subscription: subscriptions,
      product: products,
      customer: customers,
      customerWallet: customerWallets,
      organization: organizations,
    })
    .from(subscriptions)
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customers, eq(subscriptions.customerId, customers.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
    .where(eq(subscriptions.invoiceToken, token))
    .limit(1);

  if (!row?.product || !row.organization) return null;

  const [lastPayment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.subscriptionId, row.subscription.id), eq(payments.status, "confirmed")))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return {
    token,
    subscriptionId: row.subscription.id,
    status: row.subscription.status,
    amountCents: row.product.priceCents,
    currencyCode: row.product.currencyCode,
    productName: row.product.name,
    environment: row.subscription.environment,
    merchant: {
      name: row.organization.name,
      logoUrl: row.organization.logoUrl,
      supportEmail: row.organization.supportEmail,
    },
    customer: row.customer ? { name: row.customer.name, email: row.customer.email } : null,
    lastPayment: lastPayment
      ? {
          id: lastPayment.id,
          createdAt: lastPayment.createdAt,
          transactionHash: lastPayment.transactionHash,
          cryptoAmount: lastPayment.cryptoAmount,
          selectedAssetCode: lastPayment.selectedAssetCode,
        }
      : null,
  };
};

export const paySubscriptionInvoice = async (token: string, connectedWalletAddress: string) => {
  const invoice = await retrieveSubscriptionInvoice(token);
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found");
  if (invoice.status !== "overdue") return { paid: true };

  const [sub] = await db
    .select({ subscription: subscriptions, product: products, wallet: customerWallets })
    .from(subscriptions)
    .leftJoin(products, eq(subscriptions.productId, products.id))
    .leftJoin(customerWallets, eq(subscriptions.customerWalletId, customerWallets.id))
    .where(eq(subscriptions.invoiceToken, token))
    .limit(1);

  if (!sub?.product || !sub.wallet) throw new AppError("NOT_FOUND", "Subscription payment details not found");
  const wallet = sub.wallet;
  if (!wallet || wallet.address !== connectedWalletAddress) {
    throw new AppError("VALIDATION_ERROR", "Connect the wallet used for this subscription to pay the invoice");
  }

  const record = sub.subscription;
  const { data: priorPayments } = await retrievePayments(record.organizationId, record.environment, {
    subscriptionId: record.id,
    limit: 1,
  });
  const prior = priorPayments[0];
  if (!prior) throw new AppError("NOT_FOUND", "No previous subscription payment found");

  const [asset] = await retrieveSupportedAssets({ code: prior.selectedAssetCode }, record.environment);
  const { cryptoAmount: chargeDisplay, amountRaw } = await Money.calculateSubscriptionAmount({
    priceCents: sub.product.priceCents,
    currencyCode: sub.product.currencyCode,
    assetMetadata: asset?.metadata ?? {},
  });
  const billingMs = subscriptionPeriodMs(sub.product.recurringPeriod, sub.product.customDurationMs);
  if (!billingMs) throw new AppError("VALIDATION_ERROR", "Invalid subscription billing period");

  const charge = await soroban$chargeSubscription(record.environment, wallet.address, record.productId, amountRaw);
  if (charge.isErr()) throw new AppError("STELLAR_ERROR", charge.error.message);

  const payEvent = charge.value.events.find((event) => event.topic.includes("sub_pay"));
  const cryptoAmount = payEvent
    ? (Number(BigInt(String(payEvent.data.amount ?? 0))) / 10 ** STELLAR_PRECISION).toFixed(STELLAR_PRECISION)
    : chargeDisplay;
  const nextPeriod = payEvent?.data.periodEnd
    ? new Date(Number(payEvent.data.periodEnd) * 1000)
    : new Date(Date.now() + billingMs);

  await runAtomic(async () => {
    await putSubscription(
      record.id,
      { status: "active", currentPeriodStart: new Date(), currentPeriodEnd: nextPeriod },
      record.organizationId,
      record.environment
    );
    await postPayment(
      {
        subscriptionId: record.id,
        checkoutId: null,
        productId: record.productId,
        customerId: record.customerId,
        amountCents: sub.product!.priceCents,
        currencyCode: sub.product!.currencyCode,
        cryptoAmount,
        selectedAssetCode: prior.selectedAssetCode,
        selectedAssetIssuer: prior.selectedAssetIssuer,
        transactionHash: charge.value.hash,
        status: "confirmed",
        metadata: null,
        failureReason: null,
      },
      record.organizationId,
      record.environment,
      { customerWalletAddress: wallet.address }
    );
  });

  return { paid: true };
};
