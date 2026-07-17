import { z as Schema, schemaFor } from "@stellartools/core";

export interface StellarToolsMedusaAdapterOptions {
  /**
   * The API key for the Stellar Tools API.
   */
  apiKey: string;

  /**
   * Whether to enable debug mode.
   */
  debug?: boolean;

  /**
   * The webhook secret for the Stellar Tools API.
   */
  webhookSecret?: string;
}

export const stellarToolsMedusaAdapterOptionsSchema = schemaFor<StellarToolsMedusaAdapterOptions>()(
  Schema.object({
    apiKey: Schema.string(),
    debug: Schema.boolean().default(true),
    webhookSecret: Schema.string(),
  })
);
