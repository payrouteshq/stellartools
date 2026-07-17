import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import { AbstractPaymentProvider, MedusaError, PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils";
import {
  Payment,
  Result,
  z as Schema,
  StellarTools,
  WebhookEventType,
  currencyCodeSchema,
  stringifyObjectFields,
  validateSchema,
} from "@stellartools/core";
import { createHmac, timingSafeEqual } from "crypto";

import { StellarToolsMedusaAdapterOptions, stellarToolsMedusaAdapterOptionsSchema } from "./schema";

export class StellarToolsMedusaAdapter extends AbstractPaymentProvider<StellarToolsMedusaAdapterOptions> {
  static identifier = "stellar";
  private stellar: StellarTools;
  private options: StellarToolsMedusaAdapterOptions;

  constructor(cradle: any, options: StellarToolsMedusaAdapterOptions) {
    super(cradle, options);
    this.options = options;
    this.stellar = new StellarTools({ api_key: options.apiKey });
  }

  static validateOptions(options: Record<string, unknown>) {
    const { error } = stellarToolsMedusaAdapterOptionsSchema.safeParse(options);
    if (error) throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
  }

  private log(msg: string, data?: any) {
    console.info(`[Stellar] ${msg}`, data ?? "");
  }

  private unwrap<T>(result: Result<T, Error>, errorCode = MedusaError.Types.UNEXPECTED_STATE): T {
    if (!result.isOk()) {
      throw new MedusaError(errorCode, result.error?.message ?? "Stellar operation failed");
    }

    return result.value;
  }

  private parseWebhookEvent(rawBody: string, signature: string, secret: string): any {
    const parts = signature.split(",");
    const timestamp = parseInt(parts[0]?.split("=")?.[1] ?? "", 10);
    const receivedSig = parts[1]?.split("=")?.[1] ?? "";

    if (!timestamp || !receivedSig) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Malformed webhook signature header");
    }

    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestamp) > 300) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Webhook signature expired (>5 min)");
    }

    const signedPayload = `${timestamp}.${rawBody}`;

    const verify = (key: string | Buffer): boolean => {
      try {
        const expected = createHmac("sha256", key).update(signedPayload).digest("hex");
        return timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected));
      } catch {
        return false;
      }
    };

    // 1. Full secret string (e.g. "whsec_abc...")
    if (verify(secret)) return JSON.parse(rawBody);

    // 2. Base64-decoded bytes after stripping "whsec_" prefix
    if (secret.startsWith("whsec_")) {
      const decoded = Buffer.from(secret.slice(6), "base64");
      if (verify(decoded)) return JSON.parse(rawBody);
    }

    if (this.options.debug) {
      const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
      this.log("Signature mismatch", { received: receivedSig, expected, rawBodyLength: rawBody.length });
    }

    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Webhook signature verification failed");
  }

  private extractId(input: any): string {
    if (this.options.debug) {
      this.log("Getting customer ID", { input });
    }

    const id = input?.data?.id || input?.id;
    if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Stellar ID is missing from input data");
    return id;
  }

  initiatePayment = async ({
    context,
    amount,
    currency_code,
    data,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> => {
    if (this.options.debug) {
      this.log("Initiating payment", { amount, currency_code, data });
    }

    return this.unwrap(
      (
        await Result.andThenAsync(
          validateSchema(
            Schema.object({
              amount: Schema.number(),
              currency_code: currencyCodeSchema,
            }),
            {
              amount,
              currency_code,
            }
          ),
          async (valid) => {
            const checkout = await this.stellar.checkouts.createDirect(
              {
                amount_cents: Number(valid.amount) * 100,
                currency_code: valid.currency_code,
                customer_id: context?.customer?.id as string,
                redirect_url: data?.redirectUrl as string,
                metadata: {
                  ...(data?.metadata as Record<string, any> | undefined),
                  session_id: context?.idempotency_key,
                },
                description: (data?.description as string) ?? "Order Payment",
                customer_email: (data?.customerEmail ?? context?.customer?.email ?? (context as any)?.email) as string,
                customer_phone: (data?.customerPhone ?? context?.customer?.phone) as string,
              },
              { idempotencyKey: context?.idempotency_key }
            );
            return Result.ok(checkout);
          }
        )
      ).map((checkout) => ({
        id: checkout.id,
        status: PaymentSessionStatus.PENDING,
        data: { id: checkout.id, payment_url: checkout.payment_url },
      }))
    );
  };

  getPaymentStatus = async (input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> => {
    if (this.options.debug) {
      this.log("Getting payment status", { input });
    }

    const checkoutId = this.extractId(input);
    const checkout = await this.stellar.checkouts.retrieve(checkoutId);

    const statusMap: Record<string, PaymentSessionStatus> = {
      open: PaymentSessionStatus.REQUIRES_MORE,
      completed: PaymentSessionStatus.AUTHORIZED,
      expired: PaymentSessionStatus.ERROR,
      failed: PaymentSessionStatus.ERROR,
    };

    return {
      status: statusMap[checkout.status] || PaymentSessionStatus.PENDING,
      data: checkout as any,
    };
  };

  authorizePayment = async (input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> => {
    return this.getPaymentStatus(input);
  };

  capturePayment = async (): Promise<CapturePaymentOutput> => ({ data: { captured: true } });

  refundPayment = async (input: RefundPaymentInput): Promise<RefundPaymentOutput> => {
    if (this.options.debug) {
      this.log("Refunding payment", { input });
    }

    const result = validateSchema(
      Schema.object({ reason: Schema.string().nullable(), paymentId: Schema.string() }),
      input.data
    );

    if (result.isErr()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, result.error?.message ?? "Invalid refund data");
    }

    const refund = await this.stellar.refunds.create(
      {
        payment_id: result.value.paymentId,
        reason: result.value.reason ?? "",
        metadata: { source: "MedusaJS Adapter" },
      },
      { idempotencyKey: input.context?.idempotency_key }
    );

    return { data: refund as any };
  };

  createAccountHolder = async ({ context }: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> => {
    if (this.options.debug) {
      this.log("Creating account holder", { context });
    }

    const { customer } = context;

    const image = Object.entries(context?.account_holder?.data ?? {}).find(
      ([key, value]) => key.toLowerCase().includes("image") && typeof value === "string" && value.startsWith("https://")
    )?.[1] as string | null;

    const res = await this.stellar.customers.create(
      {
        email: customer?.email,
        name: `${customer?.first_name} ${customer?.last_name}`.trim(),
        phone: customer?.phone ?? undefined,
        metadata: {
          ...stringifyObjectFields((context?.account_holder?.data as Record<string, any>) ?? {}),
          source: "MedusaJS Adapter",
        },
        image,
      },
      { idempotencyKey: context?.idempotency_key }
    );

    const created = Array.isArray(res) ? res[0] : res;
    return { id: created.id, data: created as unknown as Record<string, unknown> };
  };

  updateAccountHolder = async ({ context, data }: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> => {
    if (this.options.debug) {
      this.log("Updating account holder", { context, data });
    }

    const { customer } = context;

    const res = await this.stellar.customers.update(
      this.extractId(context.account_holder),
      {
        email: customer?.email,
        name: `${customer?.first_name} ${customer?.last_name}`.trim(),
        phone: customer?.phone ?? undefined,
        metadata: data?.metadata as any,
      },
      { idempotencyKey: context?.idempotency_key }
    );

    return { data: res as any };
  };

  deleteAccountHolder = async ({ context }: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> => {
    if (this.options.debug) {
      this.log("Deleting account holder", { context });
    }

    const res = await this.stellar.customers.delete(this.extractId(context.account_holder), {
      idempotencyKey: context?.idempotency_key,
    });
    return { data: res as any };
  };

  getWebhookActionAndData = async (payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> => {
    if (this.options.debug) {
      this.log("Getting webhook action and data", { payload });
    }

    const rawEventType = (payload.data as any)?.type as string | undefined;
    if (rawEventType && !rawEventType.startsWith("payment.")) {
      return { action: PaymentActions.NOT_SUPPORTED, data: { session_id: "", amount: 0 } };
    }

    const webhookSecret = this.options.webhookSecret;

    if (!webhookSecret) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Webhook secret is missing");
    }

    const signature = (payload.headers["x-stellartools-signature"] ??
      payload.headers["X-StellarTools-Signature"]) as string;

    if (!signature) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing x-stellartools-signature header");
    }

    const event = this.parseWebhookEvent(payload.rawData.toString(), signature, webhookSecret);

    const actionMap: Partial<Record<WebhookEventType, PaymentActions>> = {
      "payment.pending": PaymentActions.PENDING,
      "payment.confirmed": PaymentActions.SUCCESSFUL,
      "payment.failed": PaymentActions.FAILED,
    };

    const action = actionMap[event.type as WebhookEventType] ?? PaymentActions.NOT_SUPPORTED;

    /**
     * We check the event type prefix. If it's a payment event,
     * TypeScript will know that event.data.object is a Payment resource.
     */
    if (event.type.startsWith("payment.")) {
      const payment = event.data.object as Payment;

      return {
        action,
        data: {
          session_id: payment.metadata?.session_id as string,
          amount: payment.amount,
        },
      };
    }

    // Non-payment events (e.g. customer.created) are silently ignored
    return { action: PaymentActions.NOT_SUPPORTED, data: { session_id: "", amount: 0 } };
  };

  cancelPayment = async () => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Blockchain transactions are immutable");
  };

  deletePayment = async () => ({ data: {} });

  updatePayment = async () => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Blockchain transactions are immutable");
  };

  retrievePayment = async (input: RetrievePaymentInput) => this.getPaymentStatus(input);
}
