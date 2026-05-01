import { Result } from "better-result";
import { z } from "zod";

import { ApiClient } from "../api-client";
import {
  CheckCreditsParams,
  ConsumeCreditParams,
  CreditBalance,
  CreditTransaction,
  CreditTransactionHistoryParams,
  CreditTransactionParams,
  checkCreditSchema,
  consumeCreditSchema,
  creditTransactionHistorySchema,
  creditTransactionSchema,
} from "../schema/credits";
import { unwrap, validateSchema } from "../utils";

export class CreditApi {
  constructor(private apiClient: ApiClient) {}

  async refund(customerId: string, params: CreditTransactionParams) {
    return unwrap(
      await Result.andThenAsync(validateSchema(creditTransactionSchema, params), async (data) => {
        return await this.apiClient.post<CreditBalance>(
          `/customers/${customerId}/credits/${data.product_id}/transaction`,
          data
        );
      })
    );
  }

  async getTransactions(customerId: string, options?: CreditTransactionHistoryParams) {
    return unwrap(
      await Result.andThenAsync(validateSchema(creditTransactionHistorySchema, options), async (data) => {
        return await this.apiClient.get<Array<CreditTransaction>>(
          `/customers/${customerId}/credits/transactions`,
          data
        );
      })
    );
  }

  async getTransaction(transactionId: string, customerId: string) {
    return unwrap(
      await Result.andThenAsync(
        validateSchema(z.object({ transactionId: z.string(), customerId: z.string() }), { transactionId, customerId }),
        async (data) => {
          return await this.apiClient.get<CreditTransaction>(
            `/customers/${data.customerId}/credits/transactions/${data.transactionId}`
          );
        }
      )
    );
  }

  async check(customerId: string, params: CheckCreditsParams) {
    return unwrap(
      await Result.andThenAsync(validateSchema(checkCreditSchema, params), async (data) => {
        return await this.apiClient.post<{ isSufficient: boolean }>(
          `/customers/${customerId}/credits/${data.product_id}/transaction`,
          { amount: data.raw_amount, dryRun: true, type: "refund" }
        );
      })
    );
  }

  async consume(customerId: string, params: ConsumeCreditParams) {
    return unwrap(
      await Result.andThenAsync(validateSchema(consumeCreditSchema, params), async (data) => {
        return await this.apiClient.post<CreditBalance>(
          `/customers/${customerId}/credits/${data.product_id}/transaction`,
          { ...data, type: "deduct", dryRun: false }
        );
      })
    );
  }
}
