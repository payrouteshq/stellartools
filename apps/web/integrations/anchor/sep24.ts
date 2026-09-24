import "server-only";

import { AnchorConfig } from "@/integrations/anchor/config";
import { assertAllowedEndpoint, getErrorCodeFromStatus, parseJsonResponse } from "@/integrations/anchor/http";
import {
  AnchorToml,
  InteractiveFlowResponse,
  Sep24Info,
  Sep24Transaction,
  getTransactionResponseSchema,
  interactiveFlowResponseSchema,
  sep24AnchorErrorSchema,
  sep24InfoSchema,
} from "@/integrations/anchor/schemas";
import { AppError } from "@/lib/action-handler";

export interface InitiateWithdrawalParams {
  assetCode: string;
  assetIssuer?: string;
  amount?: string;
  quoteId?: string;
  destinationAsset?: string;
  account?: string;
  lang?: string;
  callbackUrl?: string;
}

export function isExpiredQuoteError(error: unknown): boolean {
  return error instanceof AppError && error.status === 400 && /(?:quote.*expir|expir.*quote)/i.test(error.message);
}

const TRANSACTION_READ_ATTEMPTS = 3;
const TRANSACTION_RETRY_BASE_MS = 250;
const MAX_RETRY_AFTER_MS = 5_000;

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), MAX_RETRY_AFTER_MS);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(retryAt - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return TRANSACTION_RETRY_BASE_MS * 2 ** attempt;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class Sep24Client {
  readonly #baseUrl: URL;

  constructor(
    config: AnchorConfig,
    toml: AnchorToml,
    private readonly token: string
  ) {
    this.#baseUrl = assertAllowedEndpoint(toml.TRANSFER_SERVER_SEP0024, config.domain);
  }

  async getInfo(): Promise<Sep24Info> {
    const response = await fetch(new URL("info", this.withTrailingSlash()), {
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await this.anchorError(response, "SEP-24 info request failed");
    return parseJsonResponse(response, sep24InfoSchema);
  }

  async initiateWithdrawal(params: InitiateWithdrawalParams): Promise<InteractiveFlowResponse> {
    // The SDF reference server expects multipart form data for this endpoint.
    const body = new FormData();
    body.set("asset_code", params.assetCode);
    if (params.assetIssuer) body.set("asset_issuer", params.assetIssuer);
    if (params.amount) body.set("amount", params.amount);
    if (params.quoteId) body.set("quote_id", params.quoteId);
    if (params.destinationAsset) body.set("destination_asset", params.destinationAsset);
    if (params.account) body.set("account", params.account);
    if (params.lang) body.set("lang", params.lang);
    if (params.callbackUrl) body.set("on_change_callback", params.callbackUrl);

    const response = await fetch(new URL("transactions/withdraw/interactive", this.withTrailingSlash()), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await this.anchorError(response, "SEP-24 withdrawal initiation failed");
    return parseJsonResponse(response, interactiveFlowResponseSchema);
  }

  async getTransaction(id: string): Promise<Sep24Transaction> {
    const endpoint = new URL("transaction", this.withTrailingSlash());
    endpoint.searchParams.set("id", id);

    for (let attempt = 0; attempt < TRANSACTION_READ_ATTEMPTS; attempt++) {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${this.token}` },
        cache: "no-store",
        redirect: "error",
      });
      if (response.ok) return (await parseJsonResponse(response, getTransactionResponseSchema)).transaction;

      const isLastAttempt = attempt === TRANSACTION_READ_ATTEMPTS - 1;
      if (!isTransientStatus(response.status) || isLastAttempt) {
        throw await this.anchorError(response, "SEP-24 transaction request failed");
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)));
    }

    throw new AppError("STELLAR_ERROR", "SEP-24 transaction request failed", 500);
  }

  private withTrailingSlash(): URL {
    const url = new URL(this.#baseUrl);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  }

  private async anchorError(response: Response, fallback: string): Promise<AppError> {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = sep24AnchorErrorSchema.safeParse(payload);
    const message = parsed.success ? parsed.data.error : `${fallback} (${response.status})`;
    return new AppError(getErrorCodeFromStatus(response.status), message, response.status);
  }
}
