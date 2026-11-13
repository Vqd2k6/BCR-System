import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { appendAppErrorLog } from '../utils/app-error-log';

function readNumericOrStringProp(err: unknown, key: 'type' | 'status'): unknown {
  if (typeof err !== 'object' || err === null || !(key in err)) return undefined;
  return (err as Record<string, unknown>)[key];
}

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
    this.name = new.target.name;
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

/**
 * Report còn ảnh chưa dập được watermark thật (tải lỗi, quá nhỏ, dập lỗi, nghi ngờ dấu cũ chưa xác nhận):
 * chặn cả PDF nháp lẫn Rev. invalidParams: mỗi ảnh một dòng (field = URL ảnh, message = mã ảnh + lý do).
 */
export class WatermarkIncompleteError extends AppError {
  constructor(message: string, invalidParams: Array<{ field: string; message: string }>) {
    super(message, 409, 'WATERMARK_INCOMPLETE', invalidParams);
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
  if (err instanceof ZodError) {
    const invalidParams = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    const problem: ProblemDetails = {
      type: 'https://metro2.vn/errors/validation_error',
      title: 'Yêu cầu không hợp lệ (Validation Error)',
      status: 400,
      detail: 'Một hoặc nhiều trường dữ liệu không đáp ứng quy chuẩn validation.',
      instance: req.originalUrl,
      code: 'VALIDATION_ERROR',
      invalidParams,
      timestamp: new Date().toISOString(),
    };

    console.warn(`[VALIDATION 400 ERROR] ${req.method} ${req.originalUrl}:`, JSON.stringify(invalidParams));
    res.status(400).header('Content-Type', 'application/problem+json').json(problem);
    return;
  }

  const isAppError = err instanceof AppError;
  const isPayloadTooLarge =
    readNumericOrStringProp(err, 'type') === 'entity.too.large' ||
    readNumericOrStringProp(err, 'status') === 413 ||
    (err.message && err.message.toLowerCase().includes('too large'));

  const status = isAppError ? err.status : isPayloadTooLarge ? 413 : 500;
  const code = isAppError ? err.code : isPayloadTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_SERVER_ERROR';
  const detail = isPayloadTooLarge
    ? 'Dung lượng gói tin vượt quá giới hạn cho phép của máy chủ (Tối đa 150MB). Vui lòng nén ảnh hoặc gửi theo từng phần.'
    : err.message || 'Đã xảy ra lỗi máy chủ nội bộ';

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
    // Lỗi 500 trước đây chỉ in ra terminal backend: ghi thêm vào app_errors.log để điều tra được sau.
    if (process.env.APP_ERROR_LOG_SERVER !== 'false') {
      void appendAppErrorLog('SERVER_500', [
        `Request: ${req.method} ${req.originalUrl}`,
        `User: ${req.user?.userId ?? 'anonymous'} (${req.user?.role ?? '-'})`,
        `Code: ${code}`,
        `Message: ${err.name}: ${err.message}`,
        `Stack Trace:\n${err.stack ?? '(no stack)'}`,
      ]);
    }
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
