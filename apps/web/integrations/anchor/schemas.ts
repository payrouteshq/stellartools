import { z } from "zod";

const stellarPublicKeySchema = z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key");
const absoluteHttpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:", "HTTPS is required");
const decimalStringSchema = z
  .union([z.string(), z.number().finite().nonnegative()])
  .transform((value) => String(value))
  .pipe(z.string().regex(/^\d+(?:\.\d+)?$/, "Expected a non-negative decimal string"));

export const anchorTomlSchema = z.object({
  TRANSFER_SERVER_SEP0024: absoluteHttpsUrlSchema,
  WEB_AUTH_ENDPOINT: absoluteHttpsUrlSchema,
  SIGNING_KEY: stellarPublicKeySchema,
  ANCHOR_QUOTE_SERVER: absoluteHttpsUrlSchema.optional(),
});
export type AnchorToml = z.infer<typeof anchorTomlSchema>;

export const sep10ChallengeSchema = z.object({
  transaction: z.string().min(1),
  network_passphrase: z.string().min(1).optional(),
});

export const sep10TokenSchema = z.object({ token: z.string().min(1) });

export const sep24TransactionStatusSchema = z.enum([
  "incomplete",
  "pending_user_transfer_start",
  "pending_user_transfer_complete",
  "pending_external",
  "pending_anchor",
  "on_hold",
  "pending_stellar",
  "pending_trust",
  "pending_user",
  "completed",
  "refunded",
  "expired",
  "no_market",
  "too_small",
  "too_large",
  "error",
]);
export type Sep24TransactionStatus = z.infer<typeof sep24TransactionStatusSchema>;

const feeDetailsSchema = z.object({
  total: decimalStringSchema,
  asset: z.string().min(1),
  details: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        amount: decimalStringSchema,
      })
    )
    .optional(),
});

export const sep24TransactionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["deposit", "withdrawal"]),
  status: sep24TransactionStatusSchema,
  status_eta: z.number().int().nonnegative().optional(),
  amount_in: decimalStringSchema.optional(),
  amount_in_asset: z.string().min(1).optional(),
  amount_out: decimalStringSchema.optional(),
  amount_out_asset: z.string().min(1).optional(),
  fee_details: feeDetailsSchema.optional(),
  quote_id: z.string().min(1).optional(),
  more_info_url: absoluteHttpsUrlSchema.optional(),
  started_at: z.iso.datetime(),
  completed_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
  user_action_required_by: z.iso.datetime().optional(),
  stellar_transaction_id: z.string().min(1).optional(),
  external_transaction_id: z.string().min(1).optional(),
  message: z.string().optional(),
  withdraw_anchor_account: z.string().min(1).optional(),
  withdraw_memo: z.string().optional(),
  withdraw_memo_type: z.enum(["text", "id", "hash"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type Sep24Transaction = z.infer<typeof sep24TransactionSchema>;

export const getTransactionResponseSchema = z.object({ transaction: sep24TransactionSchema });

export const interactiveFlowResponseSchema = z.object({
  type: z.literal("interactive_customer_info_needed"),
  url: absoluteHttpsUrlSchema,
  id: z.string().min(1),
});
export type InteractiveFlowResponse = z.infer<typeof interactiveFlowResponseSchema>;

export const sep24AnchorErrorSchema = z.object({ error: z.string().min(1) });

const sep24AssetSchema = z.object({
  enabled: z.boolean(),
  min_amount: decimalStringSchema.optional(),
  max_amount: decimalStringSchema.optional(),
  fee_fixed: decimalStringSchema.optional(),
  fee_percent: z.number().nonnegative().optional(),
});

export const sep24InfoSchema = z.object({
  deposit: z.record(z.string(), sep24AssetSchema).optional(),
  withdraw: z.record(z.string(), sep24AssetSchema),
  fee: z.object({ enabled: z.boolean() }).optional(),
  features: z
    .object({
      account_creation: z.boolean().optional(),
      claimable_balances: z.boolean().optional(),
    })
    .optional(),
});
export type Sep24Info = z.infer<typeof sep24InfoSchema>;

export const sep38QuoteSchema = z.object({
  id: z.string().min(1),
  expires_at: z.iso.datetime(),
  total_price: decimalStringSchema,
  price: decimalStringSchema,
  sell_asset: z.string().min(1),
  sell_amount: decimalStringSchema,
  buy_asset: z.string().min(1),
  buy_amount: decimalStringSchema,
  fee: feeDetailsSchema,
});
export type Sep38Quote = z.infer<typeof sep38QuoteSchema>;

export const sep38InfoSchema = z.object({
  assets: z.array(
    z.object({
      asset: z.string().min(1),
      country_codes: z.array(z.string().min(2)).optional(),
    })
  ),
});
export type Sep38Info = z.infer<typeof sep38InfoSchema>;
