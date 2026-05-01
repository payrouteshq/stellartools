import { Prettify, StellarTools } from "@stellartools/core";
import type { BetterAuthOptions, BetterAuthPlugin, GenericEndpointContext, User } from "better-auth";

import * as routes from "./routes";
import { pluginSchema } from "./schema";
import type { BillingConfig } from "./types";

async function syncUserWithStellar(user: User, ctx: GenericEndpointContext<BetterAuthOptions>, options: BillingConfig) {
  const logger = ctx.context.logger;
  const client = new StellarTools({ api_key: options.api_key });

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
    options.on_customer_created?.(customerData!),
  ]).catch((err) => {
    logger.error(`Failed to sync customer ${err}`);
  });

  logger.info(`Stellar: Linked customer ${customerId} to user ${user.id}`);
}

type RouteFactories = typeof routes;
type EndpointsFromRoutes<T> = {
  [K in keyof T]: T[K] extends (options: BillingConfig) => infer R ? R : never;
};

export const stellarTools = (options: BillingConfig) => {
  const endpoints = Object.fromEntries(
    Object.entries(routes).map(([key, factory]) => [key, factory(options)])
  ) as Prettify<EndpointsFromRoutes<RouteFactories>>;

  return {
    id: "stellartools",
    endpoints,
    schema: pluginSchema,
    init: async () => ({
      options: {
        databaseHooks: {
          user: {
            create: {
              after: async (user, ctx) => {
                const shouldSync = ctx && options.create_customer_on_sign_up && !user.stellartools_customer_id;
                if (shouldSync) await syncUserWithStellar(user, ctx, options);
              },
            },
          },
        },
      },
    }),
    options,
  } satisfies BetterAuthPlugin;
};

export type StellarToolsPlugin = ReturnType<typeof stellarTools>;
