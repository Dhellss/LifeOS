/**
 * Domain error hierarchy.
 *
 * Services throw these instead of raw strings so that the HTTP layer can map
 * them onto status codes without leaking stack traces or SQL details.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    message = 'The submitted data is invalid.',
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, 422, 'VALIDATION_ERROR');
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must be signed in to do that.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} was not found.`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'That record already exists.') {
    super(message, 409, 'CONFLICT');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
