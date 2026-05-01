import { InsufficientCreditsError, createMeteredPlugin } from "@stellartools/plugin-sdk";
import * as rawAI from "ai";

type StellarToolsParams = {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;

  /**
   * The customer ID.
   */
  customer_id: string;

  /**
   * The product ID.
   */
  product_id: string;
};

const handleError = (err: unknown): never => {
  if (err instanceof InsufficientCreditsError) {
    throw new rawAI.InvalidArgumentError({
      message: err.message,
      parameter: "credits",
      value: err.required,
    });
  }
  throw err;
};

export const generateText = async (params: StellarToolsParams, ...args: Parameters<typeof rawAI.generateText>) => {
  const { api_key, customer_id, product_id } = params;

  if (!customer_id || !product_id) {
    return handleError(new Error("Customer ID and product ID are required"));
  }

  const plugin = createMeteredPlugin({ api_key });

  try {
    return await plugin.meter(
      customer_id,
      product_id,
      () => rawAI.generateText(...args),
      (result) => result.usage.totalTokens ?? 0,
      { operation: "generateText" }
    );
  } catch (err) {
    handleError(err);
  }
};

export const generateObject = async <T>(
  params: StellarToolsParams,
  ...args: Parameters<typeof rawAI.generateObject>
) => {
  const { api_key, customer_id, product_id } = params;

  if (!customer_id || !product_id) {
    return handleError(new Error("Customer ID and product ID are required"));
  }

  const plugin = createMeteredPlugin({ api_key });

  try {
    return await plugin.meter(
      customer_id,
      product_id,
      () => rawAI.generateObject(...args),
      (result) => result.usage.totalTokens ?? 0,
      { operation: "generateObject" }
    );
  } catch (err) {
    handleError(err);
  }
};

export const streamText = async (params: StellarToolsParams, ...args: Parameters<typeof rawAI.streamText>) => {
  const { api_key, customer_id, product_id } = params;

  if (!customer_id || !product_id) {
    return handleError(new Error("Customer ID and product ID are required"));
  }

  const plugin = createMeteredPlugin({ api_key });

  try {
    await plugin.preflight(customer_id, product_id);
    const originalOnFinish = args[0]?.onFinish;

    return rawAI.streamText({
      ...args[0],
      onFinish: async (event) => {
        await plugin.charge(customer_id, product_id, event.usage.totalTokens ?? 0, {
          operation: "streamText",
        });
        if (originalOnFinish) await originalOnFinish(event);
      },
    });
  } catch (err) {
    handleError(err);
  }
};

export const streamObject = async <T>(params: StellarToolsParams, ...args: Parameters<typeof rawAI.streamObject>) => {
  const { api_key, customer_id, product_id } = params;

  if (!customer_id || !product_id) {
    return handleError(new Error("Customer ID and product ID are required"));
  }

  const plugin = createMeteredPlugin({ api_key });

  try {
    await plugin.preflight(customer_id, product_id);
    const originalOnFinish = args[0]?.onFinish;

    return rawAI.streamObject({
      ...args[0],
      onFinish: async (event) => {
        await plugin.charge(customer_id, product_id, event.usage.totalTokens ?? 0, {
          operation: "streamObject",
        });
        if (originalOnFinish) await originalOnFinish(event);
      },
    });
  } catch (err) {
    handleError(err);
  }
};

export * from "ai";
