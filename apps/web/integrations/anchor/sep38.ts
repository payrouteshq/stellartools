import "server-only";

import { AnchorConfig } from "@/integrations/anchor/config";
import { AnchorRequestError, assertAllowedEndpoint, parseJsonResponse } from "@/integrations/anchor/http";
import {
  AnchorToml,
  Sep38Info,
  Sep38Quote,
  sep24AnchorErrorSchema,
  sep38InfoSchema,
  sep38QuoteSchema,
} from "@/integrations/anchor/schemas";

export interface CreateQuoteParams {
  sellAsset: string;
  buyAsset: string;
  sellAmount: string;
  countryCode?: string;
}

export class Sep38Client {
  readonly #baseUrl: URL;

  constructor(
    config: AnchorConfig,
    toml: AnchorToml,
    private readonly token: string
  ) {
    if (!toml.ANCHOR_QUOTE_SERVER) throw new Error("Anchor does not support SEP-38 quotes");
    this.#baseUrl = assertAllowedEndpoint(toml.ANCHOR_QUOTE_SERVER, config.domain);
  }

  async getInfo(): Promise<Sep38Info> {
    const response = await fetch(new URL("info", this.withTrailingSlash()), {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await this.anchorError(response, "SEP-38 info request failed");
    return parseJsonResponse(response, sep38InfoSchema);
  }

  async createQuote(params: CreateQuoteParams): Promise<Sep38Quote> {
    const response = await fetch(new URL("quote", this.withTrailingSlash()), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sell_asset: params.sellAsset,
        buy_asset: params.buyAsset,
        sell_amount: params.sellAmount,
        country_code: params.countryCode,
        context: "sep24",
      }),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw await this.anchorError(response, "SEP-38 quote request failed");
    return parseJsonResponse(response, sep38QuoteSchema);
  }

  private withTrailingSlash(): URL {
    const url = new URL(this.#baseUrl);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  }

  private async anchorError(response: Response, fallback: string): Promise<AnchorRequestError> {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = sep24AnchorErrorSchema.safeParse(payload);
    return new AnchorRequestError(
      parsed.success ? parsed.data.error : `${fallback} (${response.status})`,
      response.status
    );
  }
}
