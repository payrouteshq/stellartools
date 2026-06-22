import z from "zod";

import { schemaFor } from "../utils";
import { Environment } from "./shared";

export interface CreditBalance {
  id: string;
  customer_id: string;
  product_id: string;
  environment: Environment;
  metadata: Record<string, unknown>;
  // -- ON-CHAIN --
  channel_address: string;
  available_balance: number; // Derived: (On-chain Vault) - (Latest Voucher)
  is_closing: boolean; // Safety: true if a refund/close started on-chain

  // -- OFF-CHAIN PROOF --
  latest_cumulative_amount: number;
  latest_signature: string;
}

/**
 * Used by GET /channel/sync
 * Loads the managed pen and current tab total into the SDK.
 */
export const channelSyncSchema = z.object({
  channel: z.string(),
  metering_secret: z.string(),
  current_cumulative: z.string(),
});

export type ChannelSync = z.infer<typeof channelSyncSchema>;

/**
 * Used by POST /consume
 * Simple increment of usage.
 */
export interface ConsumeCreditParams {
  product_id: string;
  raw_amount: number;
}

export const consumeCreditSchema = schemaFor<ConsumeCreditParams>()(
  z.object({
    product_id: z.string(),
    raw_amount: z.number().positive(),
  })
);

/**
 * Used by GET /lean-balance
 * The preflight check.
 */
export const leanBalanceSchema = z.object({
  available_balance: z.number(),
  on_chain_balance: z.number(),
  unsettled_amount: z.number(),
  is_closing: z.boolean(),
});

export type LeanBalance = z.infer<typeof leanBalanceSchema>;
