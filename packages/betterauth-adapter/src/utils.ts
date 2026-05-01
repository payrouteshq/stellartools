import { StellarTools } from "@stellartools/core";
import { APIError, GenericEndpointContext, MiddlewareInputContext, MiddlewareOptions } from "better-auth";

import { BillingConfig } from "./types";

export const getContext = (ctx: GenericEndpointContext, options: BillingConfig) => {
  const session = ctx.context.session;
  if (!session?.user) throw new APIError("UNAUTHORIZED");

  return {
    user: session.user as typeof session.user & { stellartools_customer_id: string },
    stellar: new StellarTools({ api_key: options.api_key }),
    adapter: ctx.context.adapter,
  };
};
