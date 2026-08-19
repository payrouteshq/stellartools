import { getAnchorConfig } from "@/integrations/anchor/config";
import { discoverAnchor } from "@/integrations/anchor/discovery";
import { validateFundingInstructions } from "@/integrations/anchor/funding";
import { AnchorRequestError, assertAllowedEndpoint } from "@/integrations/anchor/http";
import { interactiveFlowResponseSchema, sep24InfoSchema, sep24TransactionSchema } from "@/integrations/anchor/schemas";
import { Sep24Client, isExpiredQuoteError } from "@/integrations/anchor/sep24";
import { Sep38Client } from "@/integrations/anchor/sep38";
import { mapSep24Status } from "@/integrations/anchor/status";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const config = getAnchorConfig("testnet");
const toml = {
  TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
  WEB_AUTH_ENDPOINT: "https://testanchor.stellar.org/auth",
  SIGNING_KEY: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  ANCHOR_QUOTE_SERVER: "https://testanchor.stellar.org/sep38",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("anchor configuration", () => {
  it("resolves the SDF test anchor only on testnet", () => {
    const defaultDomain = process.env.SDF_TEST_ANCHOR_DOMAIN || "testanchor.stellar.org";
    expect(config.domain).toBe(defaultDomain);
    expect(config.withdrawAssets).toContainEqual({ code: "XLM", issuer: null, sep24Code: "native" });
    expect(() => getAnchorConfig("mainnet", "sdf-test-anchor")).toThrow(
      "Anchor sdf-test-anchor is not available on mainnet"
    );
  });

  it("supports domain override via SDF_TEST_ANCHOR_DOMAIN environment variable", () => {
    const originalDomain = process.env.SDF_TEST_ANCHOR_DOMAIN;
    process.env.SDF_TEST_ANCHOR_DOMAIN = "custom-anchor.example.com";
    try {
      const overrideConfig = getAnchorConfig("testnet");
      expect(overrideConfig.domain).toBe("custom-anchor.example.com");
      expect(overrideConfig.discoveryFallback?.transferServerSep24).toBe("https://custom-anchor.example.com/sep24");
    } finally {
      process.env.SDF_TEST_ANCHOR_DOMAIN = originalDomain;
    }
  });

  it("rejects unknown anchor identifiers without a type assertion", () => {
    expect(() => getAnchorConfig("testnet", "untrusted-anchor")).toThrow(
      "No valid offramp anchor is configured for testnet"
    );
  });
});

describe("anchor discovery", () => {
  it("retries a transient TOML resolution failure", async () => {
    const resolver = vi
      .spyOn((await import("@stellar/stellar-sdk")).StellarToml.Resolver, "resolve")
      .mockRejectedValueOnce(new Error("DNS timeout"))
      .mockResolvedValueOnce({
        TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
        WEB_AUTH_ENDPOINT: "https://testanchor.stellar.org/auth",
        SIGNING_KEY: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      });

    await expect(discoverAnchor(config)).resolves.toMatchObject({
      TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
    });
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("uses the configured test-anchor fallback when discovery remains unavailable", async () => {
    vi.spyOn((await import("@stellar/stellar-sdk")).StellarToml.Resolver, "resolve").mockRejectedValue(
      new Error("DNS timeout")
    );
    const uncachedConfig = {
      ...config,
      domain: "fallback-anchor.example",
      discoveryFallback: {
        transferServerSep24: "https://fallback-anchor.example/sep24",
        webAuthEndpoint: "https://fallback-anchor.example/auth",
        signingKey: "GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR",
      },
    };

    await expect(discoverAnchor(uncachedConfig)).resolves.toMatchObject({
      TRANSFER_SERVER_SEP0024: "https://fallback-anchor.example/sep24",
      WEB_AUTH_ENDPOINT: "https://fallback-anchor.example/auth",
      SIGNING_KEY: "GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR",
    });
  });
});

describe("endpoint allow-list", () => {
  it("accepts HTTPS endpoints on the configured domain", () => {
    expect(assertAllowedEndpoint("https://testanchor.stellar.org/sep24", config.domain).pathname).toBe("/sep24");
  });

  it("rejects subdomains, insecure URLs, and unrelated hosts", () => {
    expect(() => assertAllowedEndpoint("https://evil.testanchor.stellar.org/sep24", config.domain)).toThrow();
    expect(() => assertAllowedEndpoint("http://testanchor.stellar.org/sep24", config.domain)).toThrow();
    expect(() => assertAllowedEndpoint("https://example.com/sep24", config.domain)).toThrow();
  });
});

describe("SEP-24 schemas", () => {
  it("parses normalized info and transaction responses", () => {
    expect(
      sep24InfoSchema.parse({
        withdraw: { USDC: { enabled: true, min_amount: 1, max_amount: 10 } },
      }).withdraw.USDC
    ).toEqual({ enabled: true, min_amount: "1", max_amount: "10" });

    expect(
      sep24TransactionSchema.parse({
        id: "anchor-tx-1",
        kind: "withdrawal",
        status: "pending_user_transfer_start",
        amount_in: "10.50",
        amount_in_asset: "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        started_at: "2026-08-07T12:00:00Z",
        withdraw_anchor_account: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        withdraw_memo: "123",
        withdraw_memo_type: "id",
      }).status
    ).toBe("pending_user_transfer_start");
  });

  it("rejects malformed amounts and insecure interactive URLs", () => {
    expect(() =>
      sep24TransactionSchema.parse({
        id: "anchor-tx-1",
        kind: "withdrawal",
        status: "completed",
        amount_in: "1e6",
        started_at: "2026-08-07T12:00:00Z",
      })
    ).toThrow();

    expect(() =>
      interactiveFlowResponseSchema.parse({
        type: "interactive_customer_info_needed",
        url: "http://anchor.example/flow",
        id: "anchor-tx-1",
      })
    ).toThrow();
  });
});

describe("SEP-24 client", () => {
  it("uses multipart form data and bearer authentication for withdrawal initiation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "interactive_customer_info_needed",
          url: "https://testanchor.stellar.org/flow/1",
          id: "anchor-tx-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const client = new Sep24Client(config, toml, "jwt-token");

    await client.initiateWithdrawal({
      assetCode: "USDC",
      amount: "10.50",
      quoteId: "quote-1",
      destinationAsset: "iso4217:NGN",
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe("https://testanchor.stellar.org/sep24/transactions/withdraw/interactive");
    expect(requestInit?.headers).toEqual({
      Authorization: "Bearer jwt-token",
    });
    expect(requestInit?.body).toBeInstanceOf(FormData);
    const body = requestInit?.body as FormData;
    expect(body.get("asset_code")).toBe("USDC");
    expect(body.get("amount")).toBe("10.50");
    expect(body.get("quote_id")).toBe("quote-1");
    expect(body.get("destination_asset")).toBe("iso4217:NGN");
  });

  it("does not leak an invalid provider error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ details: { bankAccount: "sensitive" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new Sep24Client(config, toml, "jwt-token");

    await expect(client.getTransaction("anchor-tx-1")).rejects.toThrow("SEP-24 transaction request failed (500)");
  });

  it("retries transient transaction lookup failures", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transaction: {
              id: "anchor-tx-1",
              kind: "withdrawal",
              status: "pending_external",
              started_at: "2026-08-07T12:00:00Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const client = new Sep24Client(config, toml, "jwt-token");

    const request = client.getTransaction("anchor-tx-1");
    await vi.runAllTimersAsync();

    await expect(request).resolves.toMatchObject({ id: "anchor-tx-1", status: "pending_external" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry permanent transaction lookup failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new Sep24Client(config, toml, "jwt-token");

    await expect(client.getTransaction("missing")).rejects.toThrow("Transaction not found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("only identifies explicit expired-quote rejections as retryable", () => {
    expect(isExpiredQuoteError(new AnchorRequestError("Quote has expired", 400))).toBe(true);
    expect(isExpiredQuoteError(new AnchorRequestError("Quote has expired", 500))).toBe(false);
    expect(isExpiredQuoteError(new AnchorRequestError("Invalid destination asset", 400))).toBe(false);
  });
});

describe("SEP-38 client", () => {
  it("creates an authenticated firm quote for the SEP-24 conversion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "quote-1",
          expires_at: "2026-08-18T12:00:00Z",
          total_price: "1600",
          price: "1580",
          sell_asset: "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          sell_amount: "2.01",
          buy_asset: "iso4217:NGN",
          buy_amount: "3200",
          fee: { total: "16", asset: "iso4217:NGN" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );
    const client = new Sep38Client(config, toml, "jwt-token");

    await expect(
      client.createQuote({
        sellAsset: "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        buyAsset: "iso4217:NGN",
        sellAmount: "2",
        countryCode: "NG",
      })
    ).resolves.toMatchObject({ id: "quote-1", sell_amount: "2.01", buy_amount: "3200" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe("https://testanchor.stellar.org/sep38/quote");
    expect(requestInit?.headers).toEqual({
      Authorization: "Bearer jwt-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      sell_asset: "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      buy_asset: "iso4217:NGN",
      sell_amount: "2",
      country_code: "NG",
      context: "sep24",
    });
  });
});

describe("status mapping", () => {
  it("maps detailed provider states to local payout summaries", () => {
    expect(mapSep24Status("pending_external")).toBe("pending");
    expect(mapSep24Status("on_hold")).toBe("pending");
    expect(mapSep24Status("completed")).toBe("succeeded");
    expect(mapSep24Status("refunded")).toBe("failed");
    expect(mapSep24Status("too_large")).toBe("failed");
  });
});

describe("funding instruction validation", () => {
  const asset = {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  };

  it("accepts matching amount, asset, destination, and typed memo", () => {
    expect(
      validateFundingInstructions({
        requestedAmount: "5.0000000",
        asset,
        transaction: sep24TransactionSchema.parse({
          id: "anchor-tx-2",
          kind: "withdrawal",
          status: "pending_user_transfer_start",
          amount_in: "5",
          amount_in_asset: "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          started_at: "2026-08-07T12:00:00Z",
          withdraw_anchor_account: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          withdraw_memo: "12345",
          withdraw_memo_type: "id",
        }),
      })
    ).toEqual({
      destination: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      amount: "5",
      memo: { type: "id", value: "12345" },
    });
  });

  it("rejects provider instructions that change the approved amount or asset", () => {
    const transaction = sep24TransactionSchema.parse({
      id: "anchor-tx-3",
      kind: "withdrawal",
      status: "pending_user_transfer_start",
      amount_in: "6",
      amount_in_asset: "stellar:SRT:GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B",
      started_at: "2026-08-07T12:00:00Z",
      withdraw_anchor_account: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });

    expect(() => validateFundingInstructions({ transaction, requestedAmount: "5", asset })).toThrow(
      "funding amount does not match"
    );
  });
});
