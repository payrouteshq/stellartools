import { CreditBalance, z as Schema, StellarTools, schemaFor, validateSchema } from "@stellartools/core";

import { BillingError, InsufficientCreditsError, InvalidProductTypeError } from "./errors";

export interface MeteredPluginConfig {
  /**
   * The API key for the Stellar Tools API.
   */
  apiKey: string;
}

export const meteredPluginConfigSchema = schemaFor<MeteredPluginConfig>()(
  Schema.object({
    apiKey: Schema.string().min(1, "API key is required"),
  })
);

export interface ChargeMetadata {
  operation?: string;
  [key: string]: unknown;
}

export interface ChargeResult {
  /**
   * The balance after the charge
   */
  balance: number;

  /**
   * The amount charged
   */
  charged: number;

  /**
   * The transaction ID of the charge
   */
  transactionId?: string;
}

export interface MeteredPlugin {
  /**
   * Check if customer has credits available (throws InsufficientCreditsError if not)
   */
  preflight(customerId: string, productId: string): Promise<void>;

  /**
   * Charge credits to customer
   */
  charge(customerId: string, productId: string, amount: number, metadata?: ChargeMetadata): Promise<ChargeResult>;

  /**
   * Refund credits to customer
   */
  refund(
    customerId: string,
    productId: string,
    amount: number,
    reason?: string,
    metadata?: ChargeMetadata
  ): Promise<ChargeResult>;

  /**
   * High-level: preflight → execute → charge (based on usage)
   */
  meter<T>(
    customerId: string,
    productId: string,
    execute: () => Promise<T>,
    getUsage: (result: T) => number,
    metadata?: ChargeMetadata
  ): Promise<T>;

  /**
   * High-level: preflight → execute → charge (fixed cost)
   * @param customerId - The ID of the customer to charge
   * @param cost - The cost to charge
   * @param execute - The function to execute
   * @param metadata - The metadata to charge
   * @returns The result of the function
   */
  gate<T>(
    customerId: string,
    productId: string,
    cost: number,
    execute: () => Promise<T>,
    metadata?: ChargeMetadata
  ): Promise<T>;

  /**
   *  Get current balance for customer
   *  @param customerId - The ID of the customer to get the balance for
   *  @returns The current balance for the customer
   */
  getBalance(customerId: string): Promise<CreditBalance>;

  /**
   * Access to underlying StellarTools client for low-level access
   * @type {StellarTools}
   * @readonly
   */
  readonly client: StellarTools;

  /**
   * Config used to create this plugin
   * @readonly
   */
  readonly config: Readonly<MeteredPluginConfig>;
}

export function createMeteredPlugin(config: MeteredPluginConfig): MeteredPlugin {
  const response = validateSchema(meteredPluginConfigSchema, config);

  if (response.isErr()) {
    throw new BillingError(`Invalid config: ${response.error.message}`, "UNKNOWN");
  }

  const { apiKey } = response.value;

  const stellar = new StellarTools({ apiKey });

  const preflight = async (customerId: string, productId: string): Promise<void> => {
    try {
      const product = await stellar.products.retrieve(productId);
      if (product.type !== "metered") {
        throw new InvalidProductTypeError(productId);
      }

      const result = await stellar.credits.check(customerId, { productId, rawAmount: 1 });

      if (!result.isSufficient) {
        throw new InsufficientCreditsError("Insufficient credits", 1, 0);
      }
    } catch (err) {
      if (err instanceof InvalidProductTypeError) throw err;
      if (err instanceof InsufficientCreditsError) throw err;
      throw new BillingError(err instanceof Error ? err.message : "Preflight check failed", "UNKNOWN");
    }
  };

  const charge = async (
    customerId: string,
    productId: string,
    amount: number,
    metadata?: ChargeMetadata
  ): Promise<ChargeResult> => {
    if (amount <= 0) return { balance: 0, charged: 0 };

    try {
      const result = await stellar.credits.consume(customerId, {
        productId,
        rawAmount: amount,
        reason: "deduct",
        metadata: { source: "Plugin SDK", ...metadata },
      });

      return { balance: result.balance, charged: amount, transactionId: result.id };
    } catch (err) {
      throw new BillingError(err instanceof Error ? err.message : "Charge failed", "UNKNOWN");
    }
  };

  const refund = async (
    customerId: string,
    productId: string,
    amount: number,
    reason?: string,
    metadata?: ChargeMetadata
  ): Promise<ChargeResult> => {
    if (amount <= 0) return { balance: 0, charged: 0 };

    try {
      const result = await stellar.credits.refund(customerId, {
        productId,
        amount,
        reason: reason ?? "refund",
        metadata: { source: "Plugin SDK", ...metadata },
      });

      return { balance: result.balance, charged: -amount, transactionId: result.id };
    } catch (err) {
      throw new BillingError(err instanceof Error ? err.message : "Refund failed", "UNKNOWN");
    }
  };

  /**
   * @example
   * import { createMeteredPlugin } from "@stellartools/plugin-sdk";
   * import { ffmpeg } from "../lib/ffmpeg";
   * const billing = createMeteredPlugin({ apiKey: "your-api-key", productId: "your-product-id" });
   *
   * app.post("/transcode", async (req, res) => {
   *   const { customerId, videoUrl, format } = req.body;
   *   const result = await billing.meter(customerId, async () => {
   *     const video = await ffmpeg.transcode(videoUrl, format);
   *     return { url: video.outputUrl, durationSeconds: video.duration };
   *   }, (result) => Math.ceil(result.durationSeconds)); // 1 credit per second
   *   res.json({ url: result.url });
   * });
   */
  const meter = async <T>(
    customerId: string,
    productId: string,
    execute: () => Promise<T>,
    getUsage: (result: T) => number,
    metadata?: ChargeMetadata
  ): Promise<T> => {
    await preflight(customerId, productId);
    const result = await execute();
    const usage = getUsage(result);
    if (usage > 0) {
      await charge(customerId, productId, usage, metadata);
    }
    return result;
  };

  const gate = async <T>(
    customerId: string,
    productId: string,
    cost: number,
    execute: () => Promise<T>,
    metadata?: ChargeMetadata
  ): Promise<T> => {
    await preflight(customerId, productId);
    const result = await execute();
    if (cost > 0) {
      await charge(customerId, productId, cost, metadata);
    }
    return result;
  };

  const getBalance = async (customerId: string): Promise<CreditBalance> => {
    throw new BillingError("getBalance not yet implemented", "UNKNOWN");
  };

  return {
    preflight,
    charge,
    refund,
    meter,
    gate,
    getBalance,
    client: stellar,
    config: Object.freeze({ ...config }),
  };
}
