import { Request, Response, NextFunction } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code?: string;
  invalidParams?: Array<{ field: string; message: string }>;
  timestamp: string;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly invalidParams?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    invalidParams?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.invalidParams = invalidParams;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Dữ liệu yêu cầu không hợp lệ', invalidParams?: Array<{ field: string; message: string }>) {
    super(message, 400, 'BAD_REQUEST', invalidParams);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Chưa xác thực hoặc token không hợp lệ') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Bạn không có quyền thực hiện hành động này') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Không tìm thấy tài nguyên yêu cầu') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Tài nguyên đã tồn tại hoặc xảy ra xung đột dữ liệu') {
    super(message, 409, 'CONFLICT');
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Dữ liệu không đáp ứng quy tắc nghiệp vụ', invalidParams?: Array<{ field: string; message: string }>) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', invalidParams);
  }
}

/**
 * Global Exception Filter tuân thủ RFC 7807 Problem Details
 */
export function problemDetailsErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const detail = err.message || 'Đã xảy ra lỗi máy chủ nội bộ';

  const problem: ProblemDetails = {
    type: `https://metro2.vn/errors/${code.toLowerCase()}`,
    title: getTitleForStatus(status),
    status,
    detail,
    instance: req.originalUrl,
    code,
    invalidParams: isAppError ? err.invalidParams : undefined,
    timestamp: new Date().toISOString(),
  };

  if (status >= 500) {
    console.error(`[SERVER 500 ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(status).header('Content-Type', 'application/problem+json').json(problem);
}

function getTitleForStatus(status: number): string {
  switch (status) {
    case 400: return 'Yêu cầu không hợp lệ (Bad Request)';
    case 401: return 'Chưa xác thực (Unauthorized)';
    case 403: return 'Không có quyền truy cập (Forbidden)';
    case 404: return 'Không tìm thấy dữ liệu (Not Found)';
    case 409: return 'Xung đột dữ liệu (Conflict)';
    case 422: return 'Lỗi nghiệp vụ dữ liệu (Unprocessable Entity)';
    default: return 'Lỗi máy chủ nội bộ (Internal Server Error)';
  }
}
