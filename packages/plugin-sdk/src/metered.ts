import { z as Schema, StellarTools, schemaFor, validateSchema } from "@stellartools/core";

import { InsufficientCreditsError, InvalidProductTypeError } from "./errors";

export interface MeteredPluginConfig {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;
}

export const meteredPluginConfigSchema = schemaFor<MeteredPluginConfig>()(
  Schema.object({
    api_key: Schema.string().min(1, "API key is required"),
  })
);

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
  transaction_id?: string;
}

export interface MeteredPlugin {
  /**
   * Check if customer has credits available (throws InsufficientCreditsError if not)
   */
  preflight(customerId: string, productId: string): Promise<void>;

  /**
   * Charge credits to customer
   */
  charge(customerId: string, productId: string, amount: number): Promise<ChargeResult>;

  /**
   * @example
   * import { createMeteredPlugin } from "@stellartools/plugin-sdk";
   * import { ffmpeg } from "../lib/ffmpeg";
   * const billing = createMeteredPlugin({ api_key: "your-api-key", productId: "your-product-id" });
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
  meter<T>(
    customerId: string,
    productId: string,
    execute: () => Promise<T>,
    getUsage: (result: T) => number
  ): Promise<T>;

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
  if (response.isErr()) throw new Error("Invalid Config");

  const stellar = new StellarTools({ api_key: response.value.api_key });

  const preflight = async (customerId: string, productId: string): Promise<void> => {
    const product = await stellar.products.retrieve(productId);

    if (product.type !== "metered") throw new InvalidProductTypeError(productId);

    await stellar.credits.sync(customerId, productId);

    const balance = await stellar.credits.getLeanBalance(customerId, productId);

    if (balance.availableBalance <= 0) {
      throw new InsufficientCreditsError("Insufficient credits", 1, 0);
    }
  };

  // 2. CHARGE: Cryptographic Voucher Swap
  const charge = async (customerId: string, productId: string, amount: number): Promise<ChargeResult> => {
    if (amount <= 0) return { balance: 0, charged: 0 };

    const result = await stellar.credits.consume(customerId, {
      product_id: productId,
      raw_amount: amount,
    });

    return {
      balance: result.remaining_balance,
      charged: amount,
      transaction_id: "off-chain-voucher",
    };
  };

  return {
    preflight,
    charge,
    meter: async (customerId, productId, execute, getUsage) => {
      await preflight(customerId, productId);
      const result = await execute();
      const usage = getUsage(result);
      await charge(customerId, productId, usage);
      return result;
    },
    client: stellar,
    config: Object.freeze({ ...config }),
  };
}
