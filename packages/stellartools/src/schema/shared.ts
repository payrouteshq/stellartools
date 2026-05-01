import { z } from "zod";

import { schemaFor } from "../utils";

export const environmentSchema = z.enum(["testnet", "mainnet"]);

export type Environment = z.infer<typeof environmentSchema>;

export interface StellarToolsConfig {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;
}

export const stellarToolsConfigSchema = schemaFor<StellarToolsConfig>()(
  z.object({
    api_key: z.string(),
  })
);
