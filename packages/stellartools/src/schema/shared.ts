import { z } from "zod";

import { schemaFor } from "../utils";
import { API_VERSIONS, ApiVersion } from "../versioning";

export const environmentSchema = z.enum(["testnet", "mainnet"]);

export type Environment = z.infer<typeof environmentSchema>;

export interface StellarToolsConfig {
  /**
   * The API key for the Stellar Tools API.
   */
  api_key: string;

  /**
   * The API version to use for all requests. Defaults to the latest version.
   */
  version?: ApiVersion;
}

export const stellarToolsConfigSchema = schemaFor<StellarToolsConfig>()(
  z.object({
    api_key: z.string(),
    version: z.enum(API_VERSIONS).optional(),
  })
);
