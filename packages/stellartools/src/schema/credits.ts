import z from "zod";

import { schemaFor } from "../utils";
import { Environment } from "./shared";

export interface CreditBalance {
  /**
   * The unique identifier for the credit balance.
   */
  id: string;

  /**
   * The customer ID of the credit balance.
   */
  customer_id: string;

  /**
   * The product ID of the credit balance.
   */
  product_id: string;

  /**
   * The environment of the credit balance.
   */
  environment: Environment;

  /**
   * The metadata of the credit balance.
   */
  metadata: Record<string, unknown>;

  /**
   * The balance of the credit balance.
   */
  balance: number;

  /**
   * The consumed amount of the credit balance.
   */
  consumed: number;

  /**
   * The granted amount of the credit balance.
   */
  granted: number;

  /**
   * The created at timestamp for the credit balance.
   */
  created_at: string;

  /**
   * The updated at timestamp for the credit balance.
   */
  updated_at: string;
}

export interface CreditTransaction {
  /**
   * The unique identifier for the credit transaction.
   */
  id: string;
  /**
   * The customer ID of the credit transaction.
   */
  customer_id: string;
  /**
   * The product ID of the credit transaction.
   */
  product_id: string;
  /**
   * The balance ID of the credit transaction.
   */
  balance_id: string;
  /**
   * The amount of the credit transaction.
   */
  amount: number;

  /**
   * The balance before the credit transaction.
   */
  balance_before: number;

  /**
   * The balance after the credit transaction.
   */
  balance_after: number;

  /**
   * The reason of the credit transaction.
   */
  reason: string;

  /**
   * The metadata of the credit transaction.
   */
  metadata: Record<string, unknown>;

  /**
   * The created at timestamp for the credit transaction.
   */
  created_at: string;

  /**
   * The updated at timestamp for the credit transaction.
   */
  updated_at: string;
}

export interface CreditTransactionParams {
  /**
   * The product ID of the credit transaction.
   */
  product_id: string;

  /**
   * The amount of credits to deduct.
   */
  amount: number;

  /**
   * The reason of the credit transaction.
   */
  reason?: string;

  /**
   * The metadata of the credit transaction.
   */
  metadata?: Record<string, unknown>;
}

export const creditTransactionSchema = schemaFor<CreditTransactionParams>()(
  z.object({
    product_id: z.string(),
    amount: z.number(),
    reason: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
);

export interface CreditTransactionHistoryParams {
  /**
   * The product ID of the credit transaction.
   */
  product_id: string;

  /**
   * The limit of the credit transaction history.
   */
  limit?: number;

  /**
   * The offset of the credit transaction history.
   */
  offset?: number;
}

export const creditTransactionHistorySchema = schemaFor<CreditTransactionHistoryParams>()(
  z.object({
    product_id: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
);

export interface CheckCreditsParams {
  /**
   * The product ID of the credit action.
   */
  product_id: string;

  /**
   * The raw amount of the credit action.
   */
  raw_amount: number;
}

export const checkCreditSchema = schemaFor<CheckCreditsParams>()(
  z.object({
    product_id: z.string(),
    raw_amount: z.number(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
);

export interface ConsumeCreditParams {
  /**
   * The product ID of the credit action.
   */
  product_id: string;

  /**
   * The reason of the credit action.
   */
  reason: "deduct" | "refund" | "grant";

  /**
   * The raw amount of the credit action.
   */
  raw_amount: number;

  /**
   * The metadata of the credit action.
   */
  metadata?: Record<string, unknown>;
}

export const consumeCreditSchema = schemaFor<ConsumeCreditParams>()(
  z.object({
    product_id: z.string(),
    reason: z.enum(["deduct", "refund", "grant"]),
    raw_amount: z.number(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
);
