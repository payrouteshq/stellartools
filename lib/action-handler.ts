export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function safeAction<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) {
        // Next.js does NOT mask returned data,
        // only thrown Error instances.
        return { __isAppError: true, message: e.message };
      }
      // Re-throw genuine system errors (DB crash, etc) so they remain masked/logged
      throw e;
    }
  }) as T;
}

/**
 * Converts the returned "error object" back into a thrown error
 * so our existing onError/toast logic works without changes.
 */
export const execute = async <T>(promise: Promise<T>): Promise<T> => {
  const result = await promise;
  if (result && typeof result === "object" && "__isAppError" in result) {
    throw new Error((result as any).message);
  }
  return result;
};
