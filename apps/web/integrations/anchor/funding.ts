import { AnchorAssetConfig } from "@/integrations/anchor/config";
import { Sep24Transaction } from "@/integrations/anchor/schemas";
import { StellarPaymentMemo, isValidPublicKey } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import Big from "big.js";

function stellarAssetIdentifier(asset: AnchorAssetConfig): string {
  return asset.issuer ? `stellar:${asset.code}:${asset.issuer}` : "stellar:native";
}

export interface FundingInstructions {
  destination: string;
  amount: string;
  memo?: StellarPaymentMemo;
}

export function validateFundingInstructions(params: {
  transaction: Sep24Transaction;
  requestedAmount: string;
  asset: AnchorAssetConfig;
}): FundingInstructions {
  const { transaction, requestedAmount, asset } = params;
  if (transaction.kind !== "withdrawal" || transaction.status !== "pending_user_transfer_start") {
    throw new AppError("CONFLICT", "The payout provider is not ready to receive funds");
  }
  if (!transaction.withdraw_anchor_account || isValidPublicKey(transaction.withdraw_anchor_account).isErr()) {
    throw new AppError("VALIDATION_ERROR", "The payout provider returned an invalid funding account");
  }
  if (!transaction.amount_in || !new Big(transaction.amount_in).eq(new Big(requestedAmount))) {
    throw new AppError("CONFLICT", "The provider funding amount does not match the approved payout amount");
  }
  if (transaction.amount_in_asset !== stellarAssetIdentifier(asset)) {
    throw new AppError("CONFLICT", "The provider funding asset does not match the approved payout asset");
  }

  if (!transaction.withdraw_memo) {
    return { destination: transaction.withdraw_anchor_account, amount: transaction.amount_in };
  }
  if (!transaction.withdraw_memo_type) {
    throw new AppError("VALIDATION_ERROR", "The payout provider returned a memo without its type");
  }

  return {
    destination: transaction.withdraw_anchor_account,
    amount: transaction.amount_in,
    memo: { type: transaction.withdraw_memo_type, value: transaction.withdraw_memo },
  };
}
