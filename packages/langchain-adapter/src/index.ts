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

const schema = Schema.object({
  apiKey: Schema.string(),
  customerId: Schema.string(),
  productId: Schema.string(),
});

type ShieldConfig = Schema.infer<typeof schema>;

/**
 * Wraps a LangChain model with StellarTools access control.
 *
 * Returns a Runnable that intercepts the chain and verifies
 * the customer's subscription status on the Stellar network.
 */
export const shield = <TModel extends BaseLanguageModel, TInput = any, TOutput = any>(
  model: TModel,
  config: ShieldConfig
): Runnable<TInput, TOutput> => {
  const { error, data } = schema.safeParse(config);

  if (error) throw new Error(`Invalid config: ${error.message}`);

  const st = new StellarTools({ api_key: data.apiKey });

  // The functional guard that runs before the model
  const guard = RunnableLambda.from(async (input: TInput) => {
    // 1. Fetch active subscriptions for this customer
    const subs = await st.subscriptions.list(data.customerId);

    // 2. Verify the specific product is active
    const hasAccess = subs.some((s) => s.product_id === data.productId && internal$hasSubscriptionAccess(s));

    if (!hasAccess) {
      throw new ShieldError(data.customerId, data.productId);
    }

    // 3. Return input to the next step in the chain (the LLM)
    return input;
  });

  return guard.pipe(model as unknown as Runnable<TInput, TOutput>);
};
