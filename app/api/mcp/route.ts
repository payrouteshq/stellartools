import { resolveAuthContext } from "@/actions/apikey";
import { getCorsHeaders } from "@/constant";
import { mcpToolsRegistry } from "@/lib/api-handler";
import { executeHandlerAsTool, getMcpSchema } from "@/lib/mcp-adapter";
import "@/lib/mcp-manifest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { NextRequest, NextResponse } from "next/server";

const sessionMap = new Map<string, { server: McpServer; transport: SSEServerTransport }>();

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const server = new McpServer({ name: "StellarTools", version: "1.0.0" });

  mcpToolsRegistry.forEach((config, name) => {
    server.tool(name, getMcpSchema(config).shape, async (args, extra: any) => {
      const auth = await resolveAuthContext({ apiKey: extra.apiKey });
      const data = await executeHandlerAsTool(config, args, auth);
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    });
  });

  // Simplified Node.js Response mock for GET
  const responseMock = {
    write: (c: string) => writer.write(encoder.encode(c)),
    end: () => writer.close(),
    on: () => {},
    setHeader: () => {},
    writeHead: () => {},
  } as any;

  const transport = new SSEServerTransport(new URL(req.url).pathname, responseMock);
  await server.connect(transport);

  sessionMap.set(transport.sessionId, { server, transport });

  return new Response(stream.readable, {
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    const session = sessionMap.get(sessionId ?? "");

    if (!session) return new Response("Session Not Found", { status: 404 });

    const { transport } = session;
    const body = await req.json();

    if (transport.onmessage) {
      (transport as any).apiKey = req.headers.get("x-api-key");

      transport.onmessage(body);
    }

    return new Response("ok", { headers: getCorsHeaders(origin) });
  } catch (error: any) {
    console.error("🔥 MCP POST ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
