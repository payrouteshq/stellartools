import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import { ConsumeCreditParams, consumeCreditSchema } from "../schema/credits";
import { unwrap, validateSchema } from "../utils";

export class CreditApi {
  constructor(private apiClient: ApiClient) {}

  /**
   * THE CRACKED SYNC
   * Tells the ApiClient to fetch the Managed Secret and initialize the
   * off-chain signature engine.
   */
  async sync(customerId: string, productId: string) {
    return await this.apiClient.setupMeteredSession(customerId, productId);
  }

  /**
   * THE CRACKED CONSUME
   * Hits the API. If a channel exists, the API returns 402.
   * The ApiClient (Ky hook) catches the 402, signs the voucher, and retries.
   */
  async consume(customerId: string, params: ConsumeCreditParams) {
    return unwrap(
      await Result.andThenAsync(validateSchema(consumeCreditSchema, params), async (data) => {
        // This endpoint is the "Bartender". It issues the 402 challenge.
        return await this.apiClient.post<{
          success: boolean;
          remaining_balance: number;
        }>(`/customers/${customerId}/credits/${data.product_id}/consume`, {
          amount: data.raw_amount,
        });
      })
    );
  }

  /**
   * PREFLIGHT CHECK
   * Derives the hard truth from the chain vs the unsettled vouchers.
   */
  async getLeanBalance(customerId: string, productId: string) {
    return unwrap(await this.apiClient.get<any>(`/customers/${customerId}/credits/${productId}/lean-balance`));
  }
}
