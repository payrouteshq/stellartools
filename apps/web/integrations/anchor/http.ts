import "server-only";

import { AppError, ErrorCode } from "@/lib/action-handler";
import { z } from "zod";

export function getErrorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMIT";
    case 502:
      return "STELLAR_ERROR";
    default:
      return status >= 500 ? "STELLAR_ERROR" : "VALIDATION_ERROR";
  }
}

export async function parseJsonResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", `Anchor returned an invalid response (${response.status})`, response.status);
  }

  return parsed.data;
}

export function assertAllowedEndpoint(endpoint: string, anchorDomain: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== anchorDomain) {
    throw new AppError("VALIDATION_ERROR", `Anchor endpoint is outside the allow-listed domain: ${url.hostname}`, 400);
  }
  return url;
}
