export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} not found: ${id}` : `${entity} not found`,
      "NOT_FOUND",
      404
    );
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ExternalServiceError extends AppError {
  public retryable: boolean;

  constructor(
    service: string,
    message: string,
    options?: { retryable?: boolean; statusCode?: number }
  ) {
    super(
      `${service}: ${message}`,
      "EXTERNAL_SERVICE_ERROR",
      options?.statusCode ?? 502
    );
    this.name = "ExternalServiceError";
    this.retryable = options?.retryable ?? true;
  }
}

export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ExternalServiceError) return error.retryable;
  if (error instanceof AuthError) return false;
  if (error instanceof ForbiddenError) return false;
  if (error instanceof ValidationError) return false;
  if (error instanceof NotFoundError) return false;
  // Default: retry unknown errors
  return true;
}
