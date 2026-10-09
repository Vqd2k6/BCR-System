import axios from 'axios';

/**
 * Lấy nội dung thông báo lỗi an toàn từ kiểu unknown trong khối catch
 */
export function getErrorMessage(err: unknown, defaultMsg: string = 'Đã xảy ra lỗi không xác định'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string; error?: string } | undefined;
    return data?.detail || data?.message || data?.error || err.message || defaultMsg;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return defaultMsg;
}

/**
 * Lấy mã trạng thái HTTP nếu có
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (axios.isAxiosError(err)) {
    return err.response?.status;
  }
  if (typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * Kiểm tra xem có phải lỗi 404 Not Found hay không
 */
export function isNotFoundError(err: unknown): boolean {
  return getErrorStatus(err) === 404;
}

/**
 * Lấy dữ liệu phản hồi thô (response.data) an toàn
 */
export function getErrorResponseData<T = unknown>(err: unknown): T | undefined {
  if (axios.isAxiosError(err)) {
    return err.response?.data as T;
  }
  return undefined;
}
