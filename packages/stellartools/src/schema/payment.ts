import z from "zod";

export const paymentStatusEnum = z.enum(["pending", "confirmed", "failed"]);

type PaymentStatus = z.infer<typeof paymentStatusEnum>;

export interface Payment {
  /**
   * The unique identifier for the payment.
   */
  id: string;

  /**
   * The checkout ID of the payment.
   */
  checkout_id: string;

  /**
   * The customer ID of the payment.
   */
  customer_id: string;

  /**
   * The subscription ID this payment belongs to, if any.
   */
  subscription_id?: string | null;

  /**
   * The amount of the payment e.g `"50 XLM"`.
   */
  amount: string;

  /**
   * The status of the payment.
   */
  status: PaymentStatus;

  /**
   * The transaction hash of the payment.
   */
  transaction_hash: string;

  /**
   * The created at timestamp for the payment.
   */
  created_at: string;

  /**
   * The metadata of the payment.
   */
  metadata: Record<string, unknown> | null;
}
