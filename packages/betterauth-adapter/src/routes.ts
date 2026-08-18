import {
  CreateRefundSchema_2026_08_18,
  CreateSubscriptionSchema_2026_08_18,
  z as Schema,
  UpdateCustomerSchema_2026_08_18,
} from "@stellartools/core";
import { GenericEndpointContext } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";

import { BillingConfig } from "./types";
import { getContext } from "./utils";

const retrieveOrCreateCustomer = async (ctx: GenericEndpointContext): Promise<string> => {
  const context = ctx?.context;
  const { user, stellar, adapter } = getContext(ctx, { apiKey: context?.api_key });

  const dbUser = await adapter.findOne<{ stellartools_customer_id: string | null }>({
    model: "user",
    where: [{ field: "id", value: user.id }],
  });

  if (dbUser?.stellartools_customer_id) return dbUser.stellartools_customer_id;

  const created = await stellar.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      source: "BetterAuth Adapter",
      ...(ctx.context.session?.session?.id ? { initialSessionId: ctx.context?.session?.session?.id } : {}),
    },
    image: user.image,
  });

  await adapter.update({
    model: "user",
    where: [{ field: "id", value: user.id }],
    update: { stellartools_customer_id: created.id },
  });

  return created.id;
};

// -- CUSTOMERS --

export const createCustomer = (options: BillingConfig) =>
  createAuthEndpoint("/stellar/customer/create", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
    const customerId = await retrieveOrCreateCustomer(ctx);
    const { stellar } = getContext(ctx, options);
    const result = await stellar.customers.retrieve(customerId);

    options?.onCustomerCreated?.(result);
    return ctx.json(result);
  });

export const retrieveCustomer = (options: BillingConfig) =>
  createAuthEndpoint("/stellar/customer/retrieve", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
    const { user, stellar } = getContext(ctx, options);
    return ctx.json(await stellar.customers.retrieve(user.stellartools_customer_id as string));
  });

export const updateCustomer = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/customer/update",
    {
      method: "POST",
      body: UpdateCustomerSchema_2026_08_18,
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const { user, stellar } = getContext(ctx, options);
      return ctx.json(await stellar.customers.update(user.stellartools_customer_id, ctx.body));
    }
  );

// -- SUBSCRIPTIONS --

export const createSubscription = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/subscription/create",
    {
      method: "POST",
      body: CreateSubscriptionSchema_2026_08_18.omit({ customer_id: true }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const customerId = await retrieveOrCreateCustomer(ctx);
      const { stellar } = getContext(ctx, options);
      const sub = await stellar.subscriptions.create({ ...ctx.body, customer_id: customerId });

      options?.onSubscriptionCreated?.(sub);

      return ctx.json(sub);
    }
  );

export const listSubscriptions = (options: BillingConfig) =>
  createAuthEndpoint("/stellar/subscriptions/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
    const { user, stellar } = getContext(ctx, options);
    return ctx.json(await stellar.subscriptions.list(user.stellartools_customer_id));
  });

// -- REFUNDS --

export const createRefund = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/refund/create",
    {
      method: "POST",
      body: CreateRefundSchema_2026_08_18,
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const { stellar } = getContext(ctx, options);
      return ctx.json(
        await stellar.refunds.create({
          payment_id: ctx.body.payment_id,
          reason: ctx.body.reason,
          metadata: { ...(ctx.body?.metadata ?? {}), source: "betterauth-adapter" },
        })
      );
    }
  );
