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
  checkoutId: string;

  /**
   * The customer ID of the payment.
   */
  customerId: string;

  /**
   * The amount of the payment e.g `"50 XLM"` or `"100 USDC"`.
   */
  amount: string;

  /**
   * The status of the payment.
   */
  status: PaymentStatus;

  /**
   * The transaction hash of the payment.
   */
  transactionHash: string;

  /**
   * The created at timestamp for the payment.
   */
  createdAt: string;

  /**
   * The metadata of the payment.
   */
  metadata: Record<string, unknown> | null;

  /**
   * The subscription ID this payment belongs to, if any.
   */
  subscriptionId?: string | null;
}
