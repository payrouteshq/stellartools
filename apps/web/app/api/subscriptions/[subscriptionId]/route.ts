import { runAtomic } from "@/actions/event";
import { retrievePaymentCount, retrievePayments } from "@/actions/payment";
import { retrieveProducts } from "@/actions/product";
import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import { Subscription } from "@/db";
import { retrieveSubscription as soroban$retrieveSubscription } from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { computeDiff, toCamelCase } from "@/lib/utils";
import { Result, z as Schema, UpdateSubscription, updateSubscriptionSchema } from "@stellartools/core";
import _ from "lodash";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey", "app", "portal"],
  requiredAppScope: "read:subscriptions",
  schema: { params: Schema.object({ subscriptionId: Schema.string() }) },
  handler: async ({ params: { subscriptionId }, auth: { organizationId, environment } }) => {
    const {
      data: [subscription],
    } = await retrieveSubscriptions(
      organizationId,
      environment,
      { subscriptionId },
      { withCustomer: true, withProduct: true, withCustomerWallets: true }
    );

    const customerWallet = subscription?.customerWallet;

    if (!customerWallet?.address) {
      return Result.err(new AppError("NOT_FOUND", "Customer wallet not found"));
    }

    const onchainSubscription = await soroban$retrieveSubscription(
      environment,
      customerWallet.address,
      subscription.productId
    );

    if (onchainSubscription.isErr())
      return Result.err(new AppError("INTERNAL_ERROR", onchainSubscription.error.message));

    const chainStateAsDb = {
      status: onchainSubscription.value.status,
      amount: Number(onchainSubscription.value.amount),
      currentPeriodEnd: new Date(Number(onchainSubscription.value.periodEnd) * 1000),
    };

    const dbComparisonState = _.pick(subscription, Object.keys(chainStateAsDb));
    const diff = computeDiff(dbComparisonState, chainStateAsDb);

    let updatedSubscription: Subscription | null = subscription;

    if (diff) {
      await runAtomic(async () => {
        const updated = await putSubscription(subscriptionId, chainStateAsDb, organizationId, environment);
        updatedSubscription = updated;
      });
    }

    const [
      lastPayment,
      {
        data: [product],
      },
      failedPaymentCount,
    ] = await Promise.all([
      retrievePayments(organizationId, environment, {
        subscriptionId,
        limit: 1,
      }).then((res) => res.data[0]),
      retrieveProducts(organizationId, environment, { productId: subscription.productId }),
      retrievePaymentCount(organizationId, environment, {
        subscriptionIds: [subscriptionId],
        status: "failed",
      }),
    ]);

    return Result.ok({
      id: updatedSubscription.id,
      customerId: updatedSubscription.customerId,
      productId: updatedSubscription.productId,
      status: updatedSubscription.status,
      currentPeriodStart: updatedSubscription.currentPeriodStart,
      currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
      canceledAt: updatedSubscription.canceledAt ?? null,
      pausedAt: updatedSubscription.pausedAt ?? null,
      failedPaymentCount,
      createdAt: updatedSubscription.createdAt ?? null,
      updatedAt: updatedSubscription.updatedAt,
      metadata: updatedSubscription.metadata ?? null,
      trialDays: updatedSubscription.trialDays ?? null,
      relatedResources: {
        product: product
          ? {
              id: product.id,
              name: product.name,
              description: product.description ?? undefined,
              images: product.images ?? [],
              status: product.status,
              type: product.type,
              priceAmountCents: product.priceCents,
              recurringPeriod: product.recurringPeriod ?? undefined,
              customDurationMs: product.customDurationMs ?? undefined,
              createdAt: product.createdAt,
              updatedAt: product.updatedAt,
              metadata: product.metadata ?? {},
              environment: product.environment,
              unit: product.unit ?? undefined,
            }
          : null,
      },
      lastAttempt: lastPayment
        ? {
            id: lastPayment.id,
            checkoutId: lastPayment.checkoutId,
            customerId: lastPayment.customerId,
            subscriptionId: lastPayment.subscriptionId ?? null,
            amount: `${lastPayment.cryptoAmount} ${lastPayment.selectedAssetCode}`,
            status: lastPayment.status,
            transactionHash: lastPayment.transactionHash,
            createdAt: lastPayment.createdAt,
            metadata: lastPayment.metadata ?? null,
            currencyCode: lastPayment.currencyCode,
            amountCents: lastPayment.amountCents,
            selectedAssetCode: lastPayment.selectedAssetCode,
            selectedAssetIssuer: lastPayment.selectedAssetIssuer ?? "",
          }
        : null,
    });
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "portal"],
  schema: { body: updateSubscriptionSchema, params: Schema.object({ subscriptionId: Schema.string() }) },
  handler: async ({ body, params: { subscriptionId }, auth: { organizationId, environment } }) => {
    const { metadata, cancelAtPeriodEnd } = toCamelCase<UpdateSubscription>(body);

    const [
      {
        data: [subscription],
      },
      failedPaymentCount,
    ] = await Promise.all([
      retrieveSubscriptions(
        organizationId,
        environment,
        { subscriptionId },
        { withCustomer: true, withProduct: true, withCustomerWallets: true }
      ),
      retrievePaymentCount(organizationId, environment, {
        subscriptionIds: [subscriptionId],
        status: "failed",
      }),
    ]);

    const customerWallet = subscription?.customerWallet;

    if (!customerWallet?.address) return Result.err(new AppError("NOT_FOUND", "Customer wallet not found"));

    const updatedSubscription = await putSubscription(
      subscriptionId,
      {
        ...(cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd }),
        ...(metadata && { metadata: { ...(subscription.metadata ?? {}), ...metadata } }),
      },
      organizationId,
      environment
    );

    return Result.ok({
      id: updatedSubscription.id,
      customerId: updatedSubscription.customerId,
      productId: updatedSubscription.productId,
      status: updatedSubscription.status,
      currentPeriodStart: updatedSubscription.currentPeriodStart,
      currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
      canceledAt: updatedSubscription.canceledAt ?? null,
      pausedAt: updatedSubscription.pausedAt ?? null,
      failedPaymentCount,
      createdAt: updatedSubscription.createdAt ?? null,
      updatedAt: updatedSubscription.updatedAt,
      metadata: updatedSubscription.metadata ?? null,
      trialDays: updatedSubscription.trialDays ?? null,
    });
  },
});
