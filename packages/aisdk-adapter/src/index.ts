import { z as Schema, StellarTools } from "@stellartools/core";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";

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
 * Creates the internal middleware that runs before every LLM call.
 */
const createShieldMiddleware = (config: ShieldConfig): LanguageModelMiddleware => {
  const { error, data } = schema.safeParse(config);

  if (error) throw new Error(`Invalid config: ${error.message}`);

  const st = new StellarTools({ api_key: data.apiKey });

  const verify = async () => {
    // We check for active subscriptions for this specific product.
    // If no active subscription is found, we block the request.
    const subs = await st.subscriptions.list(data.customerId);
    const hasAccess = subs.some(
      (s) => s.product_id === data.productId && (s.status === "active" || s.status === "trialing")
    );

    if (!hasAccess) {
      throw new ShieldError(data.customerId, data.productId);
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
 * shield
 * Wraps any AI language model with StellarTools access control.
 *
 * It intercepts the request and verifies the customer's subscription
 * status on the Stellar network before allowing the LLM to process.
 */
export const shield = (model: Parameters<typeof wrapLanguageModel>[0]["model"], config: ShieldConfig) =>
  wrapLanguageModel({
    model,
    middleware: createShieldMiddleware(config),
  });
