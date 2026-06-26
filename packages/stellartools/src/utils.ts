import { Result } from "better-result";
import { z } from "zod";

export const parseJSON = <T>(str: string, schema: z.ZodSchema<T>): T => {
  const parsed = JSON.parse(str);
  return schema.parse(parsed);
};

export const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

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

export const withRetry = async <T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 5_000): Promise<T> => {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
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
