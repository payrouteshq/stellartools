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
  CurrencyCode,
  Payment,
  Result,
  z as Schema,
  StellarTools,
  WebhookEventType,
  stringifyObjectFields,
  validateSchema,
} from "@stellartools/core";

import { StellarToolsMedusaAdapterOptions, stellarToolsMedusaAdapterOptionsSchema } from "./schema";

export class StellarToolsMedusaAdapter extends AbstractPaymentProvider<StellarToolsMedusaAdapterOptions> {
  static identifier = "stellar";
  private stellar: StellarTools;
  private options: StellarToolsMedusaAdapterOptions;

  constructor(cradle: any, options: StellarToolsMedusaAdapterOptions) {
    super(cradle, options);
    this.options = options;
    this.stellar = new StellarTools({ api_key: options.api_key });
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

  private getCustomerId(input: any): string {
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
          validateSchema(Schema.object({ amount: Schema.number(), currency_code: Schema.string() }), {
            amount,
            currency_code,
          }),
          async (valid) => {
            const checkout = await this.stellar.checkouts.createDirect({
              amount_cents: Number(valid.amount),
              currency_code: valid.currency_code as CurrencyCode,
              customer_id: context?.customer?.id as string,
              redirect_url: data?.redirectUrl as string,
              metadata: data?.metadata as any,
              description: (data?.description as string) ?? "Order Payment",
            });
            return Result.ok(checkout);
          }
        )
      ).map((checkout) => ({
        id: checkout.id,
        status: PaymentSessionStatus.REQUIRES_MORE,
        data: { id: checkout.id, payment_url: checkout.payment_url },
      }))
    );
  };

  getPaymentStatus = async (input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> => {
    if (this.options.debug) {
      this.log("Getting payment status", { input });
    }

    const payment = await this.stellar.payments.retrieve(this.getCustomerId(input));

    const statusMap: Record<string, PaymentSessionStatus> = {
      pending: PaymentSessionStatus.REQUIRES_MORE,
      confirmed: PaymentSessionStatus.AUTHORIZED,
      failed: PaymentSessionStatus.ERROR,
    };

    return {
      status: statusMap[payment.status] || PaymentSessionStatus.PENDING,
      data: payment as any,
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

    const refund = await this.stellar.refunds.create({
      payment_id: result.value.paymentId,
      reason: result.value.reason ?? "",
      metadata: { source: "MedusaJS Adapter" },
    });

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

    const res = await this.stellar.customers.create({
      email: customer?.email,
      name: `${customer?.first_name} ${customer?.last_name}`.trim(),
      phone: customer?.phone ?? undefined,
      metadata: {
        ...stringifyObjectFields((context?.account_holder?.data as Record<string, any>) ?? {}),
        source: "MedusaJS Adapter",
      },
      image,
    });

    return { id: res.id, data: res as any };
  };

  updateAccountHolder = async ({ context, data }: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> => {
    if (this.options.debug) {
      this.log("Updating account holder", { context, data });
    }

    const { customer } = context;

    const res = await this.stellar.customers.update(this.getCustomerId(context.account_holder), {
      email: customer?.email,
      name: `${customer?.first_name} ${customer?.last_name}`.trim(),
      phone: customer?.phone ?? undefined,
      metadata: data?.metadata as any,
    });

    return { data: res as any };
  };

  deleteAccountHolder = async ({ context }: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> => {
    if (this.options.debug) {
      this.log("Deleting account holder", { context });
    }

    const res = await this.stellar.customers.delete(this.getCustomerId(context.account_holder));
    return { data: res as any };
  };

  getWebhookActionAndData = async (payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> => {
    if (this.options.debug) {
      this.log("Getting webhook action and data", { payload });
    }

    const webhookSecret = this.options.webhook_secret;

    if (!webhookSecret) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Webhook secret is missing");
    }

    const event = this.stellar.webhooks.constructEvent(
      payload.rawData.toString(),
      payload.headers["X-StellarTools-Signature"] as string,
      webhookSecret
    );

    const actionMap: Partial<Record<WebhookEventType, PaymentActions>> = {
      "payment.pending": PaymentActions.PENDING,
      "payment.confirmed": PaymentActions.SUCCESSFUL,
      "payment.failed": PaymentActions.FAILED,
    };

    const action = actionMap[event.type] ?? PaymentActions.NOT_SUPPORTED;

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

    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Unsupported event type ${event.type}`);
  };

  cancelPayment = async () => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Blockchain transactions are immutable");
  };

  deletePayment = async () => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Blockchain transactions are immutable");
  };

  updatePayment = async () => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Blockchain transactions are immutable");
  };

  retrievePayment = async (input: RetrievePaymentInput) => this.getPaymentStatus(input);
}
