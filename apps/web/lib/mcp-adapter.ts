import "server-only";

import { AuthContext } from "@/types";
import { z as Schema } from "@stellartools/core";
import { NextRequest } from "next/server";

import { HandlerConfig } from "./api-handler";

export function getMcpSchema(config: any) {
  const shapes: any = {};

  const extract = (schema: any) => {
    if (!schema) return;
    if (schema.shape) Object.assign(shapes, schema.shape);
    else if (schema._def?.element?.shape) Object.assign(shapes, schema._def.element.shape);
  };

  extract(config.schema?.params);
  extract(config.schema?.query);
  extract(config.schema?.body);

  return Schema.object(shapes);
}

export async function executeHandlerAsTool(config: HandlerConfig<any, any, any>, args: any, auth: AuthContext) {
  const params: any = args;
  const query: any = args;
  const body: any = args;

  const mockReq = new NextRequest("http://localhost", {
    headers: { "x-source": "mcp" },
  });

  const result = await config.handler({
    body,
    params,
    query,
    auth,
    req: mockReq,
  });

  if (result.isErr()) throw result.error;
  return result.value;
}
