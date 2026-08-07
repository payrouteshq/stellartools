import "server-only";

import { AnchorConfig } from "@/integrations/anchor/config";
import { assertAllowedEndpoint, parseJsonResponse } from "@/integrations/anchor/http";
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

export interface InitiateWithdrawalParams {
  assetCode: string;
  assetIssuer?: string;
  amount?: string;
  quoteId?: string;
  account?: string;
  lang?: string;
  callbackUrl?: string;
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
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await this.anchorError(response, "SEP-24 transaction request failed");
    return (await parseJsonResponse(response, getTransactionResponseSchema)).transaction;
  }

  private withTrailingSlash(): URL {
    const url = new URL(this.#baseUrl);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  }

  private async anchorError(response: Response, fallback: string): Promise<Error> {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = sep24AnchorErrorSchema.safeParse(payload);
    return new Error(parsed.success ? parsed.data.error : `${fallback} (${response.status})`);
  }
}
