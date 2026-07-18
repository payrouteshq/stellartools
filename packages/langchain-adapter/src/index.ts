import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { type Runnable, RunnableLambda } from "@langchain/core/runnables";
import { z as Schema, StellarTools, internal$hasSubscriptionAccess } from "@stellartools/core";

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
  cacheTTL: Schema.number().default(60_000), // 1 minute
});

type ShieldConfig = Schema.infer<typeof shieldSchema>;

const ACCESS_CACHE = new Map<string, { hasAccess: boolean; expires: number }>();

/**
 * @example
 * const model = shield(new ChatOpenAI({}), {
 *  apiKey: process.env.STELLARTOOLS_API_KEY!,
 *  customerId: "cus_123...",
 *  productId: "prod_456...",
 * });
 */
export const shield = <TModel extends BaseLanguageModel, TInput = any, TOutput = any>(
  model: TModel,
  config: ShieldConfig
): Runnable<TInput, TOutput> => {
  const parsed = shieldSchema.parse(config);
  const st = new StellarTools({ api_key: parsed.apiKey });
  const cacheKey = `${parsed.customerId}:${parsed.productId}`;

  // The functional guard that runs before the model
  const guard = RunnableLambda.from(async (input: TInput) => {
    const now = Date.now();
    const cached = ACCESS_CACHE.get(cacheKey);

    // 1. Check local cache (0ms latency)
    if (cached && cached.expires > now) {
      if (!cached.hasAccess) throw new ShieldError(parsed.customerId, parsed.productId);
      return input;
    }

    // 2. Cache miss: Verify with StellarTools
    try {
      const subs = await st.subscriptions.list(parsed.customerId);
      const hasAccess = subs.some((s) => s.product_id === parsed.productId && internal$hasSubscriptionAccess(s));

      // 3. Update the global cache
      ACCESS_CACHE.set(cacheKey, {
        hasAccess,
        expires: now + parsed.cacheTTL,
      });

      if (!hasAccess) {
        throw new ShieldError(parsed.customerId, parsed.productId);
      }
    } catch (e) {
      // Graceful Fail-Open: If we can't reach our API but the user was
      // recently healthy, let them through to avoid breaking the chat.
      if (cached?.hasAccess) return input;

      throw e;
    }

    return input;
  });

  // Pipe the guard into the actual LLM model
  return guard.pipe(model as unknown as Runnable<TInput, TOutput>);
};
