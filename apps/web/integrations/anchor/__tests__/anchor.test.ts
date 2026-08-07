import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAnchorConfig } from "@/integrations/anchor/config";
import { assertAllowedEndpoint } from "@/integrations/anchor/http";
import { validateFundingInstructions } from "@/integrations/anchor/funding";
import {
  interactiveFlowResponseSchema,
  sep24InfoSchema,
  sep24TransactionSchema,
} from "@/integrations/anchor/schemas";
import { Sep24Client } from "@/integrations/anchor/sep24";
import { mapSep24Status } from "@/integrations/anchor/status";

const config = getAnchorConfig("testnet");
const toml = {
  TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
  WEB_AUTH_ENDPOINT: "https://testanchor.stellar.org/auth",
  SIGNING_KEY: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("anchor configuration", () => {
  it("resolves the SDF test anchor only on testnet", () => {
    expect(config.domain).toBe("testanchor.stellar.org");
    expect(config.withdrawAssets).toContainEqual({ code: "XLM", issuer: null, sep24Code: "native" });
    expect(() => getAnchorConfig("mainnet", "sdf-test-anchor")).toThrow(
      "Anchor sdf-test-anchor is not available on mainnet"
    );
  });

  it("rejects unknown anchor identifiers without a type assertion", () => {
    expect(() => getAnchorConfig("testnet", "untrusted-anchor")).toThrow(
      "No valid offramp anchor is configured for testnet"
    );
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

    await client.initiateWithdrawal({ assetCode: "USDC", amount: "10.50" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe("https://testanchor.stellar.org/sep24/transactions/withdraw/interactive");
    expect(requestInit?.headers).toEqual({
      Authorization: "Bearer jwt-token",
    });
    expect(requestInit?.body).toBeInstanceOf(FormData);
    const body = requestInit?.body as FormData;
    expect(body.get("asset_code")).toBe("USDC");
    expect(body.get("amount")).toBe("10.50");
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
          amount_in_asset:
            "stellar:USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
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
