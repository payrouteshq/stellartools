import "server-only";

import { z } from "zod";

export async function parseJsonResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(`Anchor returned an invalid response (${response.status})`);
  }

  return parsed.data;
}

export function assertAllowedEndpoint(endpoint: string, anchorDomain: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== anchorDomain) {
    throw new Error(`Anchor endpoint is outside the allow-listed domain: ${url.hostname}`);
  }
  return url;
}

