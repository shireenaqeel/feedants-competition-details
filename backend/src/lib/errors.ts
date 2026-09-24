export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (details: unknown) => new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details),
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Login required'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'You are not allowed to do this'),
  notFound: (what: string) => new AppError(404, `${what.toUpperCase()}_NOT_FOUND`, `${what} not found`),
};
