import { StellarTools } from "@stellartools/core";
import type { BetterAuthOptions, BetterAuthPlugin, GenericEndpointContext, User } from "better-auth";

import * as routes from "./routes";
import { pluginSchema } from "./schema";
import type { BillingConfig } from "./types";

async function syncUserWithStellar(user: User, ctx: GenericEndpointContext<BetterAuthOptions>, options: BillingConfig) {
  const logger = ctx.context.logger;
  const client = new StellarTools({ api_key: options.apiKey });

  const existing = await client.customers.list({ email: user.email });
  let customerId = existing?.[0]?.id ?? null;
  let customerData = existing?.[0] ?? null;

  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email,
      name: user.name,
      image: user.image,
      metadata: {
        ...(ctx.context.session?.session?.id ? { session_id: ctx.context?.session?.session?.id } : {}),
        source: "BetterAuth Adapter",
      },
    });

    customerId = customer.id;
    customerData = customer;
  }

  await Promise.allSettled([
    ctx.context.internalAdapter.updateUser(user.id, { stellartools_customer_id: customerId }),
    options.onCustomerCreated?.(customerData!),
  ]).catch((err) => {
    logger.error(`Failed to sync customer ${err}`);
  });

  logger.info(`Stellar: Linked customer ${customerId} to user ${user.id}`);
}

export const stellarTools = (options: BillingConfig): BetterAuthPlugin => ({
  id: "stellartools",
  endpoints: {
    createCustomer: routes.createCustomer(options),
    retrieveCustomer: routes.retrieveCustomer(options),
    updateCustomer: routes.updateCustomer(options),
    createSubscription: routes.createSubscription(options),
    listSubscriptions: routes.listSubscriptions(options),
    createRefund: routes.createRefund(options),
  },
  schema: pluginSchema,
  init: async () => ({
    options: {
      databaseHooks: {
        user: {
          create: {
            after: async (user, ctx) => {
              const shouldSync = ctx && options.createCustomerOnSignUp && !user.stellartools_customer_id;
              if (shouldSync) await syncUserWithStellar(user, ctx, options);
            },
          },
        },
      },
    },
  }),
  options,
});

export type StellarToolsPlugin = ReturnType<typeof stellarTools>;
