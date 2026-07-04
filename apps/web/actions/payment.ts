"use server";

import { retrieveAccount } from "@/actions/account";
import { processPaymentBilling } from "@/actions/billing";
import { retrieveCheckout, retrieveCheckoutAndCustomer } from "@/actions/checkout";
import { putCheckout } from "@/actions/checkout";
import { retrieveCustomers, upsertCustomerWallet } from "@/actions/customers";
import { paginate, runAtomic, withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganization } from "@/actions/organization";
import { retrieveProducts } from "@/actions/product";
import { PaymentStatus } from "@/constant/schema.client";
import {
  Account,
  Checkout,
  Customer,
  Network,
  Organization,
  Payment,
  Product,
  ResolvedPayment,
  customerWallets,
  customers,
  db,
  organizations,
  payments,
  refunds,
} from "@/db";
import { CustomerPaymentReceiptEmail } from "@/emails/customer-payment-receipt-email";
import { MerchantFirstPaymentConfirmedEmail } from "@/emails/merchant-first-payment-confirmed";
import { MerchantSubscriptionStartedEmail } from "@/emails/merchant-subscription-started";
import { sendEmail } from "@/integrations/email";
import { verifyPaymentByPagingToken } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import { generateResourceId, patchJSON, toSnakeCase } from "@/lib/utils";
import { ApiListParams, EventTrigger, PaginatedResult, WebhookTrigger } from "@/types";
import { all } from "better-all";
import { and, count, desc, eq, sql } from "drizzle-orm";
import moment from "moment";

type PaymentContext = {
  org: Organization;
  customer?: Customer;
  product?: Product;
  checkout?: Checkout;
  account?: Account;
};

async function loadPaymentContext(
  payment: Payment,
  organizationId: string,
  environment: Network
): Promise<PaymentContext> {
  const { org, customer, checkout, product } = await all({
    org: async () => retrieveOrganization(organizationId),
    account: async () => retrieveAccount({ organizationId }),
    customer: async () => {
      if (!payment.customerId) return undefined;
      return retrieveCustomers(
        { id: payment.customerId },
        { requireLookUpParams: true },
        organizationId,
        environment
      ).then((res) => res.data[0]);
    },
    checkout: async () => {
      if (!payment.checkoutId) return undefined;
      return retrieveCheckout(payment.checkoutId, organizationId, environment);
    },
    async product() {
      const productId = (await this.$.checkout)?.productId ?? undefined;
      if (!productId) return undefined;
      return retrieveProducts(organizationId, environment, { productId }).then(([res]) => res);
    },
  });

  return { org, customer, product, checkout };
}

const MERCHANT_EMAIL_TEMPLATES = {
  one_time: (ctx: Required<PaymentContext>, p: Payment) => ({
    subject: "Whops! You just got paid 💸",
    component: MerchantFirstPaymentConfirmedEmail({
      organizationName: ctx.org.name,
      organizationLogo: ctx.org.logoUrl,
      productName: ctx.product.name || ctx.checkout.description || "Payment",
      amount: `${p.amountCents} ${p.selectedAssetCode}`,
      assetCode: p.selectedAssetCode,
      transactionHash: p.transactionHash,
    }),
  }),
  subscription: (ctx: Required<PaymentContext>, p: Payment) => ({
    subject: "Whops! You just got a new subscription 🎉",
    component: MerchantSubscriptionStartedEmail({
      organizationName: ctx.org.name,
      organizationLogo: ctx.org.logoUrl,
      amount: `${p.amountCents} ${p.selectedAssetCode}`,
      assetCode: p.selectedAssetCode,
      currentPeriodEnd: moment(ctx.checkout.subscriptionData?.period_end).format("MMMM DD, YYYY [at] h:mm A"),
      productName: ctx.product.name || ctx.checkout.description || "Payment",
    }),
  }),
};

const paymentActionHandler = async (
  call: () => Promise<Payment>,
  organizationId: string,
  environment: Network,
  options?: { failErrorMessage?: string }
) => {
  return withEvent(call, async (payment) => {
    console.log("paymentActionHandler", payment);

    const events: EventTrigger<typeof payment>[] = [];
    const webhooks: WebhookTrigger<typeof payment>[] = [];
    const sideEffects: (() => Promise<void>)[] = [];

    const rawAmount = `${payment.amountCents} ${payment.currencyCode}`;
    const cryptoAmount = `${payment.cryptoAmount} ${payment.selectedAssetCode}`;

    const basePayload = {
      id: payment.id,
      checkoutId: payment.checkoutId!,
      customerId: payment.customerId!,
      amount: rawAmount,
      cryptoAmount: cryptoAmount,
      status: payment.status,
      transactionHash: payment.transactionHash ?? "",
      createdAt: payment.createdAt?.toISOString() ?? new Date().toISOString(),
      metadata: payment.metadata,
      currencyCode: payment.currencyCode,
      amountCents: payment.amountCents,
      selectedAssetCode: payment.selectedAssetCode,
      selectedAssetIssuer: payment.selectedAssetIssuer ?? "",
    };

    if (payment.status === "failed") {
      const errorMessage = options?.failErrorMessage ?? undefined;

      events.push({
        type: "payment::failed",
        map: (p) => ({
          customerId: p.customerId,
          data: { ...basePayload, ...(errorMessage && { error: errorMessage }) },
        }),
      });

      webhooks.push({
        event: "payment.failed",
        map: () => ({ object: toSnakeCase(basePayload), previous_attributes: undefined }),
      });
    }

    if (payment.status == "confirmed") {
      events.push({
        type: "payment::completed",
        map: (p) => ({
          customerId: p.customerId,
          subscriptionId: p.subscriptionId,
          data: { ...basePayload, subscriptionId: p.subscriptionId },
        }),
      });

      webhooks.push({
        event: "payment.confirmed",
        map: () => ({ object: toSnakeCase(basePayload), previous_attributes: undefined }),
      });

      const runBackgroundTasks = async () => {
        try {
          const ctx = await loadPaymentContext(payment, organizationId, environment);

          await processPaymentBilling(payment.id, organizationId, environment);

          if (ctx.customer?.email) {
            if (ctx.org.settings?.disableNativeEmails === true) return;

            await sendEmail(
              ctx.customer.email,
              "Payment Confirmed",
              CustomerPaymentReceiptEmail({
                customerName: ctx.customer.name,
                amount: rawAmount,
                reference: payment.id,
                date: moment().format("MMMM DD, YYYY [at] h:mm A"),
                organizationName: ctx.org.name,
                organizationLogo: ctx.org.logoUrl,
              })
            );
          }

          // Merchant "First Payout" logic
          const paymentCount = await retrievePaymentCount(organizationId, undefined, { status: "confirmed" });
          console.log("paymentCount", paymentCount);

          const emailTemplate = MERCHANT_EMAIL_TEMPLATES[ctx.product?.type as keyof typeof MERCHANT_EMAIL_TEMPLATES];
          if (paymentCount === 1 && ctx.org.supportEmail && ctx.product && ctx.checkout && emailTemplate) {
            const { subject, component } = emailTemplate(ctx as Required<PaymentContext>, payment);

            if (ctx.account?.email) {
              console.log("sending merchant first payment confirmed email to", ctx.account.email);
              await sendEmail(ctx.account.email, subject, component);
            }
          }
        } catch (e) {
          console.error("[Background Tasks Failed]", e);
        }
      };

      sideEffects.push(runBackgroundTasks);
    }

    console.log("events and webhooks");
    console.dir({ events, webhooks }, { depth: 100 });

    return {
      events,
      webhooks: { organizationId, environment, triggers: webhooks as WebhookTrigger<typeof payment>[] },
      sideEffects,
    };
  });
};

export const postPayment = async (
  params: Omit<Payment, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt" | "customerWalletId">,
  orgId?: string,
  env?: Network,
  options?: { customerWalletAddress?: string; failErrorMessage?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  let customerWalletId: string | null = null;

  if (params?.customerId && options?.customerWalletAddress) {
    customerWalletId = await upsertCustomerWallet(
      params.customerId,
      { walletAddress: options.customerWalletAddress },
      organizationId,
      environment
    ).then((w) => w?.id ?? null);
  }

  return await paymentActionHandler(
    async () => {
      const [payment] = await db
        .insert(payments)
        .values({
          ...params,
          id: generateResourceId("pay", organizationId, 25),
          organizationId,
          environment,
          customerWalletId,
          metadata: params.metadata ?? null,
          ...(options?.failErrorMessage ? { failureReason: options.failErrorMessage } : {}),
        })
        .returning();
      return payment;
    },
    organizationId,
    environment
  );
};

export const retrieveLifetimeVolumeCents = async (orgId: string, environment: Network): Promise<number> => {
  const [res] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::bigint` })
    .from(payments)
    .where(
      and(eq(payments.organizationId, orgId), eq(payments.status, "confirmed"), eq(payments.environment, environment))
    );

  console.log({ res });

  return Number(res?.total ?? 0);
};

export const retrievePayments = async (
  orgId?: string,
  env?: Network,
  params?: {
    customerId?: string;
    paymentId?: string;
    subscriptionId?: string;
    publicAccess?: boolean;
  } & ApiListParams,
  options?: {
    withCustomer?: boolean;
    withWallets?: boolean;
    withRefunds?: boolean;
    withOrg?: boolean;
  }
): Promise<PaginatedResult<ResolvedPayment>> => {
  const publicAccess = params?.publicAccess ?? false;

  let organizationId: string | undefined;
  let environment: Network | undefined;

  if (!publicAccess) {
    const { organizationId: resolvedOrganizationId, environment: resolvedEnvironment } = await resolveOrgContext(
      orgId,
      env
    );
    organizationId = resolvedOrganizationId;
    environment = resolvedEnvironment;
  }

  const limit = params?.limit ?? 10;

  const rows = await db
    .select({
      payment: payments,
      ...(options?.withRefunds && { hasRefund: refunds.id }),
      ...(options?.withWallets && { wallets: customerWallets }),
      ...(options?.withRefunds && { refunds: refunds }),
      ...(options?.withCustomer && { customer: customers }),
      ...(options?.withOrg && { org: organizations }),
    })
    .from(payments)
    .leftJoin(refunds, and(eq(payments.id, refunds.paymentId), eq(refunds.status, "succeeded")))
    .leftJoin(customerWallets, eq(payments.customerWalletId, customerWallets.id))
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .leftJoin(organizations, eq(payments.organizationId, organizations.id))
    .where(
      and(
        params?.paymentId ? eq(payments.id, params.paymentId) : undefined,
        !publicAccess && organizationId ? eq(payments.organizationId, organizationId) : undefined,
        !publicAccess && environment ? eq(payments.environment, environment) : undefined,
        params?.customerId ? eq(payments.customerId, params.customerId) : undefined,
        params?.subscriptionId ? eq(payments.subscriptionId, params.subscriptionId) : undefined
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(params?.starting_after ? parseInt(params.starting_after) : 0);

  return await paginate(
    rows.map(({ customer, payment, hasRefund, wallets, refunds, org }) => ({
      ...payment,
      refunded: !!hasRefund,
      wallets,
      refunds,
      customer,
      org,
    })),
    limit
  );
};

export const putPayment = async (id: string, orgId: string, env: Network, params: Partial<Payment>) => {
  const [
    { organizationId, environment },
    {
      data: [oldPayment],
    },
  ] = await Promise.all([resolveOrgContext(orgId, env), retrievePayments(orgId, env, { paymentId: id })]);

  if (!oldPayment) throw new AppError("Payment not found");

  const { metadata: metadataPatch, ...baseUpdate } = params;

  return paymentActionHandler(
    async () => {
      return await db
        .update(payments)
        .set({
          ...baseUpdate,
          updatedAt: new Date(),
          ...(metadataPatch !== undefined ? { metadata: patchJSON(oldPayment.metadata, metadataPatch) } : {}),
        })
        .where(and(eq(payments.id, id), eq(payments.organizationId, organizationId)))
        .returning()
        .then(([payment]) => payment);
    },
    organizationId,
    environment
  );
};

export const retrievePaymentCount = async (
  organizationId: string,
  customerId?: string,
  filter?: { status?: PaymentStatus; subscriptionId?: string }
) => {
  const [{ value: confirmedCount }] = await db
    .select({ value: count() })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        customerId ? eq(payments.customerId, customerId) : undefined,
        filter?.status ? eq(payments.status, filter.status) : undefined,
        filter?.subscriptionId ? eq(payments.subscriptionId, filter.subscriptionId) : undefined
      )
    );

  return Number(confirmedCount);
};

export const deletePayment = async (id: string, organizationId: string) => {
  await db
    .delete(payments)
    .where(and(eq(payments.id, id), eq(payments.organizationId, organizationId)))
    .returning();

  return null;
};

export const sweepAndProcessPayment = async (checkoutId: string, failureReason?: string) => {
  console.log("sweeping and processing payment", checkoutId);
  const checkout = await retrieveCheckoutAndCustomer(checkoutId);

  if (!checkout || checkout.status !== "open" || checkout.productType == "subscription") {
    return checkout;
  }

  const { organizationId, environment, initialPagingToken, merchantPublicKey, customerId } = checkout;

  const result = await verifyPaymentByPagingToken(merchantPublicKey, checkoutId, initialPagingToken!, environment);

  if (result.isErr()) throw new AppError(result.error.message);

  if (!result.value) return checkout;

  const { hash, amount, successful, from: payerAddress, assetCode, assetIssuer } = result.value;

  if (!successful) {
    await runAtomic(async () => {
      await putCheckout(checkoutId, { status: "failed" }, organizationId, environment);
      await postPayment(
        {
          subscriptionId: null,
          checkoutId,
          customerId,
          productId: checkout.productId ?? null,
          cryptoAmount: amount,
          amountCents: checkout.finalAmount,
          currencyCode: checkout.currencyCode ?? "USD",
          transactionHash: hash,
          status: "failed",
          metadata: null,
          selectedAssetCode: assetCode!,
          selectedAssetIssuer: assetIssuer ?? null,
          failureReason: "Failed to retrieve payment from horizon paging token",
        },
        organizationId,
        environment,
        { customerWalletAddress: payerAddress }
      );
    });

    return checkout;
  }

  await runAtomic(async () => {
    console.log("putting checkout to completed");
    await putCheckout(checkoutId, { status: "completed" }, checkout.organizationId, checkout.environment).catch(
      (err) => {
        console.error("Error putting checkout", err);
      }
    );

    await postPayment(
      {
        subscriptionId: null,
        customerId,
        checkoutId,
        productId: checkout.productId ?? null,
        amountCents: checkout.finalAmount,
        currencyCode: checkout.currencyCode ?? "USD",
        cryptoAmount: amount,
        transactionHash: hash,
        status: "confirmed",
        metadata: null,
        selectedAssetCode: assetCode!,
        selectedAssetIssuer: assetIssuer ?? null,
        failureReason: null,
      },
      organizationId,
      environment,
      { customerWalletAddress: payerAddress }
    );
  });

  return checkout;
};
