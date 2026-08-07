import {
  z as SchemaZod,
  SuggestedString,
  subscriptionStatusEnum as subscriptionStatusEnum$1,
} from "@stellartools/core";

export const networkEnum = ["testnet", "mainnet"] as const;

export const authProviderEnum = ["google", "local"] as const;

export const payoutStatusEnum = ["pending", "succeeded", "failed"] as const;

export const payoutMethodEnum = ["crypto", "fiat"] as const;

export const subscriptionStatusEnum = subscriptionStatusEnum$1.enum;

export type Network = (typeof networkEnum)[number];

export type AuthProvider = (typeof authProviderEnum)[number];

export type PayoutStatus = (typeof payoutStatusEnum)[number];

export type PayoutMethod = (typeof payoutMethodEnum)[number];

export type SubscriptionStatus = SchemaZod.infer<typeof subscriptionStatusEnum$1>;

export type AssetCode = SuggestedString<"XLM" | "USDC">;

export type AssetIssuer = SuggestedString<"native">;

export const paymentStatusEnum = ["pending", "confirmed", "failed"] as const;

export type PaymentStatus = (typeof paymentStatusEnum)[number];
