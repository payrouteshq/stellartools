import { Result } from "better-result";
import z from "zod";

import { ApiClient } from "./api-client";
import { AppInstallationApi } from "./resources/app-installation";
import { BalanceApi } from "./resources/balance";
import { CheckoutApi } from "./resources/checkout";
import { CustomerApi } from "./resources/customer";
import { PaymentApi } from "./resources/payment";
import { ProductApi } from "./resources/product";
import { RefundApi } from "./resources/refund";
import { SubscriptionApi } from "./resources/subscription";
import { WebhookApi } from "./resources/webhooks";
import { StellarToolsConfig, stellarToolsConfigSchema } from "./schema/shared";
import { LATEST_VERSION } from "./versioning";

export const STELLARTOOLS_ID = "STELLARTOOLS";

export const APP_TOKEN_PREFIX = "st_app_*";
export const WEBHOOK_SIGNATURE_PREFIX = "whsec_";

export class StellarTools {
  private config: StellarToolsConfig;
  public appInstallations: AppInstallationApi;
  public webhooks: WebhookApi;
  public customers: CustomerApi;
  public refunds: RefundApi;
  public checkouts: CheckoutApi;
  public payments: PaymentApi;
  public products: ProductApi;
  public subscriptions: SubscriptionApi;
  public balance: BalanceApi;

  constructor(config: StellarToolsConfig) {
    const { error, data } = stellarToolsConfigSchema.safeParse(config);
    if (error) throw new Error(`Invalid config: ${error.message}`);
    this.config = data;

    const isApp = this.config.api_key.startsWith(APP_TOKEN_PREFIX);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isApp) {
      const token = this.config.api_key.replace(APP_TOKEN_PREFIX, "");
      headers["x-stellartools-app-token"] = token;
    } else {
      headers["x-api-key"] = this.config.api_key;
    }

    const apiClient = new ApiClient({
      baseUrl: process.env.STELLAR_TOOLS_BASE_URL || "https://api.stellartools.dev",
      headers,
      maxRetries: 3,
    });

    const version = this.config.version ?? LATEST_VERSION;

    this.customers = new CustomerApi(apiClient, version);
    this.refunds = new RefundApi(apiClient, version);
    this.checkouts = new CheckoutApi(apiClient, version);
    this.payments = new PaymentApi(apiClient, version);
    this.products = new ProductApi(apiClient, version);
    this.subscriptions = new SubscriptionApi(apiClient, version);
    this.webhooks = new WebhookApi(apiClient, version);
    this.appInstallations = new AppInstallationApi(apiClient, version);
    this.balance = new BalanceApi(apiClient, version);
  }
}

export * from "./types";
export { WebhookSigner } from "./resources/webhooks";
export type { Balance } from "./resources/balance";
export { ApiClient };
export { Result };
export { schemaFor, validateSchema, parseJSON, stringifyObjectFields } from "./utils";
export { raceAsyncIterator, batchProcess } from "./promisify";
export { z };
export * from "./schema/customer";
export * from "./schema/checkout";
export * from "./schema/payment";
export * from "./schema/product";
export * from "./schema/refund";
export * from "./schema/shared";
export * from "./schema/currencies";
export * from "./schema/subscription";
export * from "./schema/webhooks";
export * from "./schema/app-installation";
export * from "./jwt";
export { SignatureVerificationError } from "./errors";
export { HandlerError, routeHandler } from "./api-handler";
export * from "./versioning";
