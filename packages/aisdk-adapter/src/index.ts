import { z as Schema, StellarTools, internal$hasSubscriptionAccess } from "@stellartools/core";
import { type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

export class ShieldError extends Error {
  constructor(
    public customerId: string,
    public productId: string
  ) {
    super(`Access Denied: Customer "${customerId}" does not have an active subscription to "${productId}".`);
    this.name = "ShieldError";
  }
}

const shieldSchema = Schema.object({
  apiKey: Schema.string(),
  customerId: Schema.string(),
  productId: Schema.string(),
  cacheTTL: Schema.number().optional().default(60_000),
});

type ShieldConfig = Schema.infer<typeof shieldSchema>;

const ACCESS_CACHE = new Map<string, { hasAccess: boolean; expires: number }>();

const createShieldMiddleware = (config: ShieldConfig): LanguageModelMiddleware => {
  const st = new StellarTools({ api_key: config.apiKey });
  const cacheKey = `${config.customerId}:${config.productId}`;

  const verify = async () => {
    const now = Date.now();
    const cached = ACCESS_CACHE.get(cacheKey);

    // 1. If we have a valid cache hit, return immediately (0ms latency)
    if (cached && cached.expires > now) {
      if (!cached.hasAccess) throw new ShieldError(config.customerId, config.productId);
      return;
    }

    // 2. Cache miss or expired: Strike the database
    try {
      const subs = await st.subscriptions.list(config.customerId);
      const hasAccess = subs.some((s) => s.product_id === config.productId && internal$hasSubscriptionAccess(s));

      // 3. Update the global cache
      ACCESS_CACHE.set(cacheKey, {
        hasAccess,
        expires: now + config.cacheTTL,
      });

      if (!hasAccess) {
        throw new ShieldError(config.customerId, config.productId);
      }
    } catch (e) {
      // If the StellarTools API is down but we have an expired "success" cache,
      // we gracefully allow the user through (Fail Open strategy) to prevent
      // bricking the merchant's AI app.
      if (cached?.hasAccess) return;

      throw e;
    }
  };

  return {
    middlewareVersion: "v2",
    wrapGenerate: async ({ doGenerate }) => {
      await verify();
      return doGenerate();
    },
    wrapStream: async ({ doStream }) => {
      await verify();
      return doStream();
    },
  };
};

/**
 * @example
 * const model = shield(openai("gpt-4o"), {
 *  apiKey: process.env.STELLARTOOLS_API_KEY!,
 *  customerId: "cus_123...",
 *  productId: "prod_456...",
 * });
 */
export const shield = (
  model: Parameters<typeof wrapLanguageModel>[0]["model"],
  config: ShieldConfig
): LanguageModel => {
  const parsed = shieldSchema.parse(config);

  return wrapLanguageModel({
    model,
    middleware: createShieldMiddleware(parsed),
  });
};
