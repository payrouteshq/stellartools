import { PayoutStatus } from "@/constant/schema.client";
import { Sep24TransactionStatus } from "@/integrations/anchor/schemas";

export function mapSep24Status(status: Sep24TransactionStatus): PayoutStatus {
  switch (status) {
    case "completed":
      return "succeeded";
    case "refunded":
    case "expired":
    case "no_market":
    case "too_small":
    case "too_large":
    case "error":
      return "failed";
    case "incomplete":
    case "pending_user_transfer_start":
    case "pending_user_transfer_complete":
    case "pending_external":
    case "pending_anchor":
    case "on_hold":
    case "pending_stellar":
    case "pending_trust":
    case "pending_user":
      return "pending";
  }
}

