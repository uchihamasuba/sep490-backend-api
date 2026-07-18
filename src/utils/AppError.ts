export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized', details?: unknown) {
    return new AppError(401, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'Forbidden', details?: unknown) {
    return new AppError(403, 'FORBIDDEN', message, details);
  }

  static notFound(message = 'Not found', details?: unknown) {
    return new AppError(404, 'NOT_FOUND', message, details);
  }

  static conflict(message = 'Conflict', details?: unknown) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static internal(message = 'Internal server error', details?: unknown) {
    return new AppError(500, 'INTERNAL_ERROR', message, details);
  }
}
