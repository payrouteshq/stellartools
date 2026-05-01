import { z as Schema, schemaFor } from "@stellartools/core";

export interface StellarToolsMedusaAdapterOptions {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;

  /**
   * Whether to enable debug mode.
   */
  debug?: boolean;

  /**
   * The webhook secret for the Stellar Tools API.
   */
  webhook_secret?: string;
}

export const stellarToolsMedusaAdapterOptionsSchema = schemaFor<StellarToolsMedusaAdapterOptions>()(
  Schema.object({
    api_key: Schema.string(),
    debug: Schema.boolean().default(true),
    webhook_secret: Schema.string(),
  })
);
