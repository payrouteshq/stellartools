const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  STRIPE_ERROR: 502,
  STELLAR_ERROR: 502,
  TOO_MANY_REQUESTS: 429,
};

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;

  constructor(code: ErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
  }
}

export function safeAction<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) {
        // Return a structured object that the UI 'execute' function understands
        return {
          __isAppError: true,
          message: e.message,
          code: e.code,
          status: e.status,
        };
      }
      // System crashes (SQL leaks) stay thrown here so apiHandler handles the masking
      throw e;
    }
  }) as T;
}

export const execute = async <T>(promise: Promise<T>): Promise<T> => {
  const result = await promise;
  if (result && typeof result === "object" && "__isAppError" in result) {
    // Re-wrap as an Error so existing .message logic in the UI doesn't break
    const err = new Error((result as any).message);
    (err as any).code = (result as any).code;
    throw err;
  }
  return result;
};
