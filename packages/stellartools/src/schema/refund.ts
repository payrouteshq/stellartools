import { z } from "zod";

import { schemaFor } from "../utils";
import { ApiVersion } from "../versioning";

export const refundStatusEnum = z.enum(["pending", "succeeded", "failed"]);

type RefundStatus = z.infer<typeof refundStatusEnum>;

export interface Refund {
  /**
   * The unique identifier for the refund.
   */
  id: string;

  /**
   * The payment ID of the refund.
   */
  payment_id: string;

  /**
   * The customer ID of the refund.
   */
  customer_id?: string | null;

  /**
   * The amount of the refund e.g `"50 XLM"`.
   */
  amount: string;

  /**
   * The reason for the refund.
   */
  reason: string | null;

  /**
   * The status of the refund.
   */
  status: RefundStatus;

  /**
   * The created at timestamp for the refund.
   */
  created_at: string;

  /**
   * The metadata for the refund.
   */
  metadata: Record<string, unknown> | null;

  /**
   * The receiver public key of the refund.
   */
  receiver_wallet_address: string | null;
}

export const refundSchema = schemaFor<Refund>()(
  z.object({
    id: z.string(),
    payment_id: z.string(),
    customer_id: z.string(),
    amount: z.string(),
    reason: z.string(),
    status: refundStatusEnum,
    created_at: z.string(),
    metadata: z.record(z.string(), z.any()).default({}).nullable(),
    receiver_wallet_address: z.string().nullable(),
  })
);

export const CreateRefundSchema_2026_08_18 = z.object({
  payment_id: z.string(),
  reason: z.string(),
  metadata: z.record(z.string(), z.any()).default({}).nullable(),
});

export interface CreateRefund extends z.infer<typeof CreateRefundSchema_2026_08_18> {}

export const REFUND_SCHEMAS = {
  "2026-08-18": { create: CreateRefundSchema_2026_08_18 },
} satisfies Record<ApiVersion, { create: z.ZodSchema }>;
