import { Result } from "better-result";
import { z } from "zod";

import { RequestOptions } from "./types";

export const parseJSON = <T>(str: string, schema: z.ZodSchema<T>): T => {
  const parsed = JSON.parse(str);
  return schema.parse(parsed);
};

export const validateSchema = <T>(schema: z.ZodType<T>, data: unknown): Result<T, Error> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("; ");
    return Result.err(new Error(message));
  }

  return Result.ok(result.data);
};

export const schemaFor = <TInterface>() => {
  return <TSchema extends z.ZodType<TInterface>>(schema: TSchema): TSchema => schema;
};

export const unwrap = <T>(result: Result<T, Error>): T => {
  if (result.isErr()) {
    throw new Error(result.error?.message ?? "Operation failed");
  }

  return result.value!;
};

/**
 * Safely converts metadata values to strings for provider storage.
 * Only stringifies non-string values to prevent nested JSON escaping.
 *
 * @example
 * stringifyObjectFields({ count: 5, name: "John" })
 * // => { count: "5", name: "John" }
 *
 * stringifyObjectFields({ data: { nested: true } })
 * // => { data: "{\"nested\":true}" }
 */
export const stringifyObjectFields = (object: Record<string, any>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])
  );
};

export function mapOptionsToHeaders(options?: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { ...options?.headers };

  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  return headers;
}
