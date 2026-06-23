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

export const executeWithRetryWithHandler = async <T>(
  apiCall: () => Promise<T>,
  errorHandler: (error: unknown, attempt: number) => { retry: boolean; data: unknown },
  maxRetries: number = 3,
  baseDelay: number = 1000,
  currentAttempt: number = 1
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    const handledError = errorHandler(error, currentAttempt);

    if (!handledError.retry) return handledError.data as T;

    if (handledError.retry && currentAttempt <= maxRetries) {
      const delay = baseDelay * Math.pow(2, currentAttempt - 1) * (0.5 + Math.random() * 0.5);

      await new Promise((resolve) => setTimeout(resolve, delay));

      return executeWithRetryWithHandler(apiCall, errorHandler, maxRetries, baseDelay, currentAttempt + 1);
    }

    return handledError.data as T;
  }
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
