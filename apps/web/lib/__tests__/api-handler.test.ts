import { resolveAuthContext } from "@/actions/apikey";
import { getStoredResponse, saveIdempotencyResult, tryAcquireLock } from "@/actions/idempotency";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/apikey");
vi.mock("@/actions/idempotency");
vi.mock("@/constant", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const createReq = (method: string, headers: Record<string, string> = {}, body?: any) => {
  return new NextRequest("https://api.stellartools.dev/test", {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
};

const MOCK_AUTH_CONTEXT = {
  organizationId: "org_123",
  environment: "testnet" as const,
  type: "apikey" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveAuthContext).mockResolvedValue(MOCK_AUTH_CONTEXT);
  vi.mocked(getStoredResponse).mockResolvedValue(undefined);
  vi.mocked(tryAcquireLock).mockResolvedValue([{ id: "lock" }] as any);
});

describe("apiHandler: Authentication & Lifecycle", () => {
  it("denies access if no credentials are provided for a protected route", async () => {
    const handler = apiHandler({
      auth: ["apikey"],
      handler: async () => Result.ok({ success: true }),
    });

    const req = createReq("GET"); // No headers
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("API Key required");
  });

  it("denies access if the auth resolver returns null", async () => {
    vi.mocked(resolveAuthContext).mockResolvedValue(null);

    const handler = apiHandler({
      auth: ["apikey"],
      handler: async () => Result.ok({ success: true }),
    });

    const req = createReq("GET", { "x-api-key": "invalid" });
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("correctly routes multiple auth scopes (Vercel Cron example)", async () => {
    const handler = apiHandler({
      auth: ["vercelToken"],
      handler: async () => Result.ok({ verified: true }),
    });

    const req = createReq("GET", { authorization: "Bearer cron_secret" });
    await handler(req, { params: Promise.resolve({}) });

    expect(resolveAuthContext).toHaveBeenCalledWith(
      expect.objectContaining({
        vercelToken: "Bearer cron_secret",
      })
    );
  });

  it("executes the handler and returns data when auth is valid", async () => {
    const handler = apiHandler({
      auth: ["apikey"],
      handler: async () => Result.ok({ data: "secret info" }),
    });

    const req = createReq("GET", { "x-api-key": "st_key_123" });
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: "secret info" });
  });
});

describe("apiHandler: Permissions & Validation", () => {
  describe("App Scopes (RBAC)", () => {
    const appHandler = apiHandler({
      auth: ["app"],
      requiredAppScope: "read:payments",
      handler: async () => Result.ok({ data: "payment_list" }),
    });

    it("denies access (403) if the app token lacks the required scope", async () => {
      vi.mocked(resolveAuthContext).mockResolvedValue({
        ...MOCK_AUTH_CONTEXT,
        type: "app",
        scopes: ["read:customers"], // Missing read:payments
      } as any);

      const req = createReq("GET", { "x-stellartools-app-token": "st_app_123" });
      const res = await appHandler(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Forbidden: App missing scope [read:payments]" });
    });

    it("allows access if the app token has a wildcard '*' scope", async () => {
      vi.mocked(resolveAuthContext).mockResolvedValue({
        ...MOCK_AUTH_CONTEXT,
        type: "app",
        scopes: ["*"], // Wildcard
      } as any);

      const req = createReq("GET", { "x-stellartools-app-token": "st_app_123" });
      const res = await appHandler(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });

    it("allows 'read:app-installation' automatically for any app token", async () => {
      const dangerHandler = apiHandler({
        auth: ["app"],
        requiredAppScope: "read:app-installation",
        handler: async () => Result.ok({ settings: {} }),
      });

      vi.mocked(resolveAuthContext).mockResolvedValue({
        ...MOCK_AUTH_CONTEXT,
        type: "app",
        scopes: [], // No explicit scopes, but read:app-installation is hardcoded as allowed
      } as any);

      const req = createReq("GET", { "x-stellartools-app-token": "st_app_123" });
      const res = await dangerHandler(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });
  });

  describe("Input Validation (Zod)", () => {
    const validatedHandler = apiHandler({
      auth: ["apikey"],
      schema: {
        body: Schema.object({ name: Schema.string() }),
        query: Schema.object({ limit: Schema.coerce.number() }),
        params: Schema.object({ id: Schema.string() }),
      },
      handler: async ({ body, query, params }) => {
        // Return back the parsed types to verify coercion
        return Result.ok({
          bodyType: typeof body.name,
          queryType: typeof query.limit,
          paramsId: params.id,
        });
      },
    });

    it("returns 400 if the body does not match the schema", async () => {
      const req = createReq("POST", { "x-api-key": "key" }, { name: 123 }); // Name should be string
      const res = await validatedHandler(req, { params: Promise.resolve({ id: "1" }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Expected string, received number");
    });

    it("correctly coerces query parameters and validates params", async () => {
      // URL has ?limit=50 (string), should be coerced to number
      const req = new NextRequest("https://api.stellartools.dev/test?limit=50", {
        method: "POST",
        headers: { "x-api-key": "key" },
        body: JSON.stringify({ name: "Stellar" }),
      });

      const res = await validatedHandler(req, { params: Promise.resolve({ id: "valid_id" }) });
      const body = await res.json();

      expect(body.queryType).toBe("number"); // Coerced
      expect(body.bodyType).toBe("string");
      expect(body.paramsId).toBe("valid_id");
      expect(res.status).toBe(200);
    });
  });
});

describe("apiHandler: Advanced Logic", () => {
  describe("Idempotency (Safe Retries)", () => {
    const postHandler = apiHandler({
      auth: ["apikey"],
      handler: async () => Result.ok({ id: "pay_done", amount: 100 }),
    });

    it("returns a cached response if the idempotency key already exists", async () => {
      const cachedBody = { id: "pay_done_old", amount: 100 };
      vi.mocked(getStoredResponse).mockResolvedValue({
        responseStatus: 200,
        responseBody: cachedBody,
        lockedAt: null, // Lock was released because it finished
      } as any);

      const req = createReq(
        "POST",
        {
          "x-api-key": "key",
          "Idempotency-Key": "key_1",
        },
        { amount: 100 }
      );

      const res = await postHandler(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(cachedBody);
      // Ensure the handler was NEVER called
      expect(saveIdempotencyResult).not.toHaveBeenCalled();
    });

    it("returns 409 if a request with the same key is currently in progress", async () => {
      vi.mocked(getStoredResponse).mockResolvedValue({
        lockedAt: new Date(), // Currently locked
        responseStatus: null, // No result yet
      } as any);

      const req = createReq("POST", {
        "x-api-key": "key",
        "Idempotency-Key": "key_1",
      });

      const res = await postHandler(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Request in progress" });
    });

    it("saves the successful result to the database upon completion", async () => {
      const req = createReq("POST", {
        "x-api-key": "key",
        "Idempotency-Key": "key_unique",
      });

      await postHandler(req, { params: Promise.resolve({}) });

      expect(saveIdempotencyResult).toHaveBeenCalledWith(
        "key_unique",
        "org_123",
        200,
        expect.objectContaining({ id: "pay_done" })
      );
    });
  });

  describe("Output Formatting", () => {
    it("automatically converts camelCase to snake_case by default", async () => {
      const handler = apiHandler({
        auth: ["apikey"],
        handler: async () =>
          Result.ok({
            customerId: "cus_1",
            amountCents: 5000,
            nest: { someField: true },
          }),
      });

      const req = createReq("GET", { "x-api-key": "key" });
      const res = await handler(req, { params: Promise.resolve({}) });
      const body = await res.json();

      expect(body).toEqual({
        customer_id: "cus_1",
        amount_cents: 5000,
        nest: { some_field: true },
      });
    });

    it("handles BigInt and Date serialization correctly", async () => {
      const handler = apiHandler({
        auth: ["apikey"],
        handler: async () =>
          Result.ok({
            rawAmount: BigInt(1000000000),
            createdAt: new Date("2024-01-01T10:00:00Z"),
          }),
      });

      const req = createReq("GET", { "x-api-key": "key" });
      const res = await handler(req, { params: Promise.resolve({}) });
      const body = await res.json();

      expect(body.raw_amount).toBe(1000000000); // BigInt -> Number
      expect(body.created_at).toBe("2024-01-01T10:00:00.000Z"); // Date -> ISO String
    });

    it("skips snake_case conversion if 'convertToSnakeCase' is false", async () => {
      const handler = apiHandler({
        auth: ["apikey"],
        convertToSnakeCase: false,
        handler: async () => Result.ok({ customerId: "cus_1" }),
      });

      const req = createReq("GET", { "x-api-key": "key" });
      const res = await handler(req, { params: Promise.resolve({}) });
      const body = await res.json();

      expect(body).toHaveProperty("customerId");
      expect(body).not.toHaveProperty("customer_id");
    });
  });

  describe("MCP Integration", () => {
    it("registers the tool in the mcpToolsRegistry if a name is provided", async () => {
      const mcpConfig = { name: "get_balance", description: "Fetch XLM balance" };
      apiHandler({
        auth: ["apikey"],
        mcp: mcpConfig,
        handler: async () => Result.ok({ balance: 10 }),
      });

      const { mcpToolsRegistry } = await import("@/lib/api-handler");
      expect(mcpToolsRegistry.has("get_balance")).toBe(true);
      expect(mcpToolsRegistry.get("get_balance")?.mcp?.description).toBe("Fetch Account balance");
    });
  });
});
