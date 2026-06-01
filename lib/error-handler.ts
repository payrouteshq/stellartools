export class AppError extends Error {
  readonly isAppError = true;

  constructor(message: string) {
    super(message);
    this.name = "AppError";
    // Next.js reads this digest in the error boundary
    // Setting it prevents the generic message replacement
    (this as any).digest = message;
  }
}
