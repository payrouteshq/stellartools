import { z as Schema, stringifyObjectFields } from "@stellartools/core";
import { GenericEndpointContext } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";

import { BillingConfig } from "./types";
import { getContext } from "./utils";

const retrieveOrCreateCustomer = async (ctx: GenericEndpointContext): Promise<string> => {
  const context = ctx?.context;
  const { user, stellar, adapter } = getContext(ctx, { api_key: context?.api_key });

  const dbUser = await adapter.findOne<{ stellartools_customer_id: string }>({
    model: "user",
    where: [{ field: "id", value: user.id }],
  });

  if (dbUser?.stellartools_customer_id) return dbUser.stellartools_customer_id;

  const customer = await stellar.customers.create({
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
    update: { stellartools_customer_id: customer.id },
  });

  return customer.id;
};

// -- CUSTOMERS --

export const createCustomer = (options: BillingConfig) =>
  createAuthEndpoint("/stellar/customer/create", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
    const customerId = await retrieveOrCreateCustomer(ctx);
    const { stellar } = getContext(ctx, options);
    const result = await stellar.customers.retrieve(customerId);

    options?.on_customer_created?.(result);
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
      body: Schema.object({
        email: Schema.email().optional(),
        name: Schema.string().optional(),
        phone: Schema.string().optional(),
        metadata: Schema.record(Schema.string(), Schema.string()).nullable().optional(),
      }),
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
      body: Schema.object({
        product_id: Schema.string(),
        metadata: Schema.record(Schema.string(), Schema.unknown()).optional(),
        cancel_at_period_end: Schema.boolean(),
        period: Schema.object({ from: Schema.coerce.date(), to: Schema.coerce.date() }),
      }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const customerId = await retrieveOrCreateCustomer(ctx);
      const { stellar } = getContext(ctx, options);
      const sub = await stellar.subscriptions.create({ ...ctx.body, customer_ids: [customerId] });

      options?.on_subscription_created?.(sub);

      return ctx.json(sub);
    }
  );

export const listSubscriptions = (options: BillingConfig) =>
  createAuthEndpoint("/stellar/subscriptions/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
    const { user, stellar } = getContext(ctx, options);
    return ctx.json(await stellar.subscriptions.list(user.stellartools_customer_id));
  });

// -- REFUNDS --

const DEFAULT_CREDITS_LOW_THRESHOLD = 10;

export const consumeCredits = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/credits/consume",
    {
      method: "POST",
      body: Schema.object({
        product_id: Schema.string(),
        raw_amount: Schema.number(),
        metadata: Schema.record(Schema.string(), Schema.unknown()).optional(),
      }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const customerId = await retrieveOrCreateCustomer(ctx);
      const { stellar } = getContext(ctx, options);

      // Use "BAD_REQUEST" for consumption failures (e.g., insufficient balance)
      const result = await stellar.credits.consume(customerId, {
        ...ctx.body,
        reason: "deduct",
        metadata: { ...stringifyObjectFields(ctx.body.metadata ?? {}), source: "betterauth-adapter" },
      });

      if (options.on_credits_low && result.balance <= (options.credit_low_threshold ?? DEFAULT_CREDITS_LOW_THRESHOLD)) {
        await options.on_credits_low({ ...result, customer_id: customerId });
      }

      return ctx.json(result);
    }
  );

export const getTransactions = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/credits/transactions",
    {
      method: "GET",
      query: Schema.object({
        product_id: Schema.string(),
        limit: Schema.coerce.number().optional(),
        offset: Schema.coerce.number().optional(),
      }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const customerId = await retrieveOrCreateCustomer(ctx);
      const { stellar } = getContext(ctx, options);

      // ctx.query already contains productId, limit, and offset
      const result = await stellar.credits.getTransactions(customerId, ctx.query);

      return ctx.json(result);
    }
  );

// -- REFUNDS --

export const createRefund = (options: BillingConfig) =>
  createAuthEndpoint(
    "/stellar/refund/create",
    {
      method: "POST",
      body: Schema.object({
        payment_id: Schema.string(),
        reason: Schema.string(),
        metadata: Schema.record(Schema.string(), Schema.unknown()).optional(),
      }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const { stellar } = getContext(ctx, options);
      return ctx.json(
        await stellar.refunds.create({
          payment_id: ctx.body.payment_id,
          reason: ctx.body.reason,
          metadata: { ...stringifyObjectFields(ctx.body?.metadata ?? {}), source: "betterauth-adapter" },
        })
      );
    }
  );
