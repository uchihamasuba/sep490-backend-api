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

  static badRequest(message = 'Yêu cầu không hợp lệ', details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Chưa xác thực', details?: unknown) {
    return new AppError(401, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'Không đủ quyền truy cập', details?: unknown) {
    return new AppError(403, 'FORBIDDEN', message, details);
  }

  static notFound(message = 'Không tìm thấy dữ liệu', details?: unknown) {
    return new AppError(404, 'NOT_FOUND', message, details);
  }

  static conflict(message = 'Dữ liệu bị trùng lặp', details?: unknown) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static internal(message = 'Lỗi hệ thống, vui lòng thử lại sau', details?: unknown) {
    return new AppError(500, 'INTERNAL_ERROR', message, details);
  }
}
