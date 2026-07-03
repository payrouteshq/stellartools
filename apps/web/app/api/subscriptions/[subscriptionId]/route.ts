import { runAtomic } from "@/actions/event";
import { retrievePayments } from "@/actions/payment";
import { retrieveProducts } from "@/actions/product";
import { putSubscription, retrieveSubscriptions } from "@/actions/subscription";
import { Subscription } from "@/db";
import {
  cancelSubscription as cancelSorobanSubscription,
  retrieveSubscription as retrieveSorobanSubscription,
} from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { computeDiff, toCamelCase, toSnakeCase } from "@/lib/utils";
import { Result, z as Schema, updateSubscriptionSchema } from "@stellartools/core";
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
      return Result.err(new AppError("Customer wallet not found"));
    }

    const onchainSubscription = await retrieveSorobanSubscription(
      environment,
      customerWallet.address,
      subscription.productId
    );

    if (onchainSubscription.isErr()) return Result.err(onchainSubscription.error);

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

    const [lastPayment, [product]] = await Promise.all([
      retrievePayments(organizationId, environment, {
        subscriptionId,
        limit: 1,
      }).then((res) => res.data[0]),
      retrieveProducts(organizationId, environment, { productId: subscription.productId }),
    ]);

    return Result.ok(
      toSnakeCase({
        id: updatedSubscription.id,
        customerId: updatedSubscription.customerId,
        productId: updatedSubscription.productId,
        status: updatedSubscription.status,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        metadata: updatedSubscription.metadata,
        trialDays: updatedSubscription.trialDays,
        updatedAt: updatedSubscription.updatedAt,
        createdAt: updatedSubscription.createdAt,

        relatedResources: { product },
        lastAttempt: lastPayment,
      })
    );
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "portal"],
  schema: { body: updateSubscriptionSchema, params: Schema.object({ subscriptionId: Schema.string() }) },
  handler: async ({ body, params: { subscriptionId: id }, auth: { organizationId, environment } }) => {
    const { metadata, cancelAtPeriodEnd, productId } = toCamelCase<any>(body);
    const {
      data: [subscription],
    } = await retrieveSubscriptions(
      organizationId,
      environment,
      { subscriptionId: id },
      { withCustomer: true, withProduct: true, withCustomerWallets: true }
    );

    const customerWallet = subscription?.customerWallet;

    if (!customerWallet?.address) return Result.err(new AppError("Customer wallet not found"));

    let cancellationResult: Awaited<ReturnType<typeof cancelSorobanSubscription>> | null = null;

    if (cancelAtPeriodEnd) {
      cancellationResult = await cancelSorobanSubscription(
        environment,
        customerWallet.address,
        subscription.customerId,
        subscription.productId
      );
    }

    if (cancellationResult?.isErr()) return Result.err(cancellationResult.error);

    const updatedSubscription = await putSubscription(
      id,
      {
        ...(cancelAtPeriodEnd && { cancelAtPeriodEnd }),
        ...(metadata && { metadata: { ...(subscription.metadata ?? {}), ...metadata } }),
        ...(productId && { productId }),
      },
      organizationId,
      environment
    );

    return Result.ok(updatedSubscription);
  },
});
