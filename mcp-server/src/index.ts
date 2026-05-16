import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response as ExpressResponse } from "express";

const TEXT_MAX = 30_000;
const DEFAULT_PORT = 8787;

const READ_ONLY_TOOL = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

type Transport = "http" | "stdio";

interface Env {
  transport: Transport;
  port: number;
  appUrl: string;
  sandboxAppUrl: string;
  apiKey: string;
  docsMcpUrl: string;
  publicMcpUrl: string;
  publicSandboxMcpUrl: string;
  name: string;
  version: string;
}


function truncate(text: string): { type: "text"; text: string } {
  if (text.length <= TEXT_MAX) return { type: "text", text };
  return { type: "text", text: `${text.slice(0, TEXT_MAX)}\n\n…truncated` };
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return undefined;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

function loadEnv(): Env {
  const rawTransport = (process.env.MCP_TRANSPORT ?? "http").toLowerCase();
  const rawPort = Number(process.env.MCP_SERVER_PORT!);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PORT;
  const publicMcpUrl =  process.env.MCP_PUBLIC_URL!
  const appUrl = process.env.STELLARTOOLS_APP_URL!

  return {
    transport: rawTransport === "stdio" ? "stdio" : "http",
    port,
    appUrl,
    sandboxAppUrl: appUrl,
    apiKey: process.env.STELLARTOOLS_API_KEY ?? "",
    docsMcpUrl: process.env.STELLARTOOLS_DOCS_MCP_URL!,
    publicMcpUrl,
    publicSandboxMcpUrl:  process.env.MCP_PUBLIC_SANDBOX_URL!,
    name: process.env.MCP_SERVER_NAME!,
    version: process.env.MCP_SERVER_VERSION!,
  };
}

function buildSkillCard(env: Env): string {
  return [
    "# Stellar Tools (read-only)",
    "",
    `Metrics MCP: ${env.publicMcpUrl} (sandbox: ${env.publicSandboxMcpUrl})`,
    `Docs MCP (read-only): ${env.docsMcpUrl}`,
    "",
    "This server only reads org metrics. For doc search/read, use the Mintlify docs MCP — not the Mintlify write MCP.",
  ].join("\n");
}

function createMcp(env: Env, userApiKey: string, appUrl: string): McpServer {
  const server = new McpServer(
    { name: env.name, version: env.version },
    { capabilities: { resources: {}, tools: {} } }
  );

  server.registerResource(
    "stellartools",
    "mintlify://skills/stellartools",
    {
      mimeType: "text/markdown",
      description: "Read-only Stellar Tools MCP — metrics and pointers to docs MCP.",
    },
    async () => ({
      contents: [
        {
          uri: "mintlify://skills/stellartools",
          mimeType: "text/markdown",
          text: buildSkillCard(env),
        },
      ],
    })
  );

  server.registerTool(
    "get_organization_metrics",
    {
      title: "get_organization_metrics",
      annotations: READ_ONLY_TOOL,
      description:
        "Read-only. Returns customers, subscriptions, trials, MRR, and 28-day net revenue (USD cents) for the org tied to the request API key.",
      inputSchema: {},
    },
    async () => {
      if (!appUrl) {
        throw new Error("Server misconfiguration: STELLARTOOLS_APP_URL is not set.");
      }

      const res = await fetch(`${appUrl}/mcp/organization-metrics`, {
        method: "GET",
        headers: { "x-api-key": userApiKey, accept: "application/json" },
      });
      const text = await res.text();

      if (res.status === 401 || res.status === 403) {
        throw new Error("Invalid API key. Get one at https://stellartools.dev/settings/api-keys");
      }
      if (!res.ok) {
        throw new Error(`Metrics request failed (${res.status}): ${text.slice(0, 800)}`);
      }

      return { content: [truncate(text)] };
    }
  );

  return server;
}

async function handleMcpPost(
  req: Request,
  res: ExpressResponse,
  env: Env,
  appUrl: string
): Promise<void> {
  const userApiKey = extractBearerToken(req);
  if (!userApiKey) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized. Use Authorization: Bearer <your-api-key>",
      },
      id: null,
    });
    return;
  }

  const mcp = createMcp(env, userApiKey, appUrl);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });

  await mcp.connect(transport);
  await transport.handleRequest(req as never, res as never, req.body);
}

async function startHttp(env: Env): Promise<void> {
  const { default: express } = await import("express");
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.get("/health", (_req: Request, res: ExpressResponse) => {
    res.json({
      ok: true,
      readOnly: true,
      mcp: env.publicMcpUrl,
      sandbox: env.publicSandboxMcpUrl,
      docsMcp: env.docsMcpUrl,
    });
  });

  const methodNotAllowed = (_req: Request, res: ExpressResponse) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  };

  app.get("/mcp", methodNotAllowed);
  app.get("/mcp/sandbox", methodNotAllowed);

  app.post("/mcp", async (req, res) => {
    await handleMcpPost(req, res, env, env.appUrl);
  });
  app.post("/mcp/sandbox", async (req, res) => {
    await handleMcpPost(req, res, env, env.sandboxAppUrl);
  });

  await new Promise<void>((resolve, reject) => {
    http
      .createServer(app as http.RequestListener)
      .listen(env.port)
      .once("listening", resolve)
      .once("error", (err: Error & { code?: string }) => {
        reject(err.code === "EADDRINUSE" ? new Error(`Port ${env.port} in use`) : err);
      });
  });

  console.error(`MCP (read-only) ${env.publicMcpUrl}`);
  console.error(`Sandbox ${env.publicSandboxMcpUrl}`);
}

async function main(): Promise<void> {
  const env = loadEnv();

  if (env.transport === "stdio") {
    if (!env.apiKey) {
      throw new Error("Set STELLARTOOLS_API_KEY in .env for stdio mode.");
    }
    await createMcp(env, env.apiKey, env.appUrl).connect(new StdioServerTransport());
    return;
  }

  await startHttp(env);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
