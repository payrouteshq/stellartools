import { resolveAuthContext } from "@/actions/apikey";
import { getCorsHeaders } from "@/constant";
import { mcpToolsRegistry } from "@/lib/api-handler";
import { executeHandlerAsTool, getMcpSchema } from "@/lib/mcp-adapter";
import "@/lib/mcp-manifest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createMcpServer(apiKey: string | null) {
  const server = new McpServer({ name: "StellarTools", version: "1.0.0" });

  mcpToolsRegistry.forEach((config, name) => {
    server.tool(name, getMcpSchema(config).shape, async (args) => {
      const auth = await resolveAuthContext({ apiKey });
      if (!auth) {
        return { content: [{ type: "text", text: "Unauthorized" }] };
      }
      const data = await executeHandlerAsTool(config, args, auth);
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    });
  });

  return server;
}

function withCorsHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(origin))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function methodNotAllowed(origin: string | null): Response {
  return withCorsHeaders(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed. Use POST for MCP requests." },
        id: null,
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
      }
    ),
    origin
  );
}

async function cleanup(server: McpServer, transport: WebStandardStreamableHTTPServerTransport) {
  await transport.close();
  await server.close();
}

async function handleMcpPost(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin");
  const apiKey = req.headers.get("x-api-key");
  const server = createMcpServer(apiKey);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(req);
    const corsResponse = withCorsHeaders(response, origin);

    if (!corsResponse.body) {
      await cleanup(server, transport);
      return corsResponse;
    }

    const reader = corsResponse.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await cleanup(server, transport);
          return;
        }
        controller.enqueue(value);
      },
      async cancel() {
        await reader.cancel();
        await cleanup(server, transport);
      },
    });

    return new Response(stream, {
      status: corsResponse.status,
      statusText: corsResponse.statusText,
      headers: corsResponse.headers,
    });
  } catch (error: unknown) {
    console.error("MCP request error:", error);
    await cleanup(server, transport);
    return withCorsHeaders(
      new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      origin
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  return methodNotAllowed(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  return handleMcpPost(req);
}

export async function DELETE(req: NextRequest) {
  return methodNotAllowed(req.headers.get("origin"));
}
