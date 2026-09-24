/**
 * Dev Error Reporter Service
 * 
 * Tự động bắt lỗi runtime (window.onerror) và unhandled promise rejection (window.onunhandledrejection)
 * trong môi trường phát triển (DEV), lọc bỏ các lỗi ngoại vi (browser extensions, ResizeObserver, v.v.),
 * và gửi về backend để ghi nối tiếp vào tệp `app_errors.log` tại thư mục gốc của dự án.
 */

export interface DevErrorPayload {
  errorType: 'RUNTIME_ERROR' | 'UNHANDLED_PROMISE_REJECTION' | 'REACT_ERROR_BOUNDARY' | 'CUSTOM_DEV_ERROR';
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url: string;
  timestamp?: string;
  userAgent?: string;
  componentStack?: string;
}

// Bảng cache tạm để chống spam/lặp lại lỗi giống hệt nhau trong thời gian ngắn (debouncing)
const recentErrorTimestamps = new Map<string, number>();
const DEBOUNCE_WINDOW_MS = 2500;

// Cờ chống vòng lặp đệ quy nếu fetch báo cáo lỗi gặp trục trặc
let isReportingInProgress = false;

/**
 * Kiểm tra xem lỗi có thuộc diện ngoại vi (browser extension, hệ điều hành, ResizeObserver) cần bỏ qua không.
 */
function isIgnoredError(message: string, stack?: string, source?: string): boolean {
  const normalizedMsg = (message || '').toLowerCase();
  const normalizedStack = (stack || '').toLowerCase();
  const normalizedSource = (source || '').toLowerCase();

  // 1. Lỗi từ các tiện ích mở rộng trình duyệt (Browser Extensions)
  const extensionPatterns = [
    'runtime.lasterror',
    'the message port closed before a response was received',
    'extension context invalidated',
    'could not establish connection. receiving end does not exist',
    'unchecked runtime.lasterror',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'chrome://',
    'moz-extension://',
    'devtools://',
  ];

  for (const pattern of extensionPatterns) {
    if (
      normalizedMsg.includes(pattern) ||
      normalizedStack.includes(pattern) ||
      normalizedSource.includes(pattern)
    ) {
      return true;
    }
  }

  // 2. Cảnh báo an toàn không phải lỗi nghiệp vụ từ trình duyệt (ResizeObserver)
  if (
    normalizedMsg.includes('resizeobserver loop completed with undelivered notifications') ||
    normalizedMsg.includes('resizeobserver loop limit exceeded')
  ) {
    return true;
  }

  // 3. Lỗi từ chính endpoint report-error (tránh loop)
  if (
    normalizedMsg.includes('/api/dev/report-error') ||
    normalizedStack.includes('/api/dev/report-error') ||
    normalizedSource.includes('/api/dev/report-error')
  ) {
    return true;
  }

  return false;
}

/**
 * Gửi payload lỗi về backend endpoint /api/dev/report-error
 */
export async function sendDevError(payload: DevErrorPayload): Promise<void> {
  // Chỉ chạy trong môi trường Development của Vite
  if (!import.meta.env.DEV) {
    return;
  }

  // Chống vòng lặp
  if (isReportingInProgress) {
    return;
  }

  // Kiểm tra lỗi bị bỏ qua
  if (isIgnoredError(payload.message, payload.stack, payload.source)) {
    return;
  }

  // Chống spam lặp cùng 1 lỗi trong 2.5 giây
  const errorKey = `${payload.errorType}:${payload.message}:${payload.source || ''}:${payload.lineno || ''}`;
  const now = Date.now();
  const lastTime = recentErrorTimestamps.get(errorKey);
  if (lastTime && now - lastTime < DEBOUNCE_WINDOW_MS) {
    return;
  }
  recentErrorTimestamps.set(errorKey, now);

  // Dọn dẹp cache cũ sau 10 giây
  if (recentErrorTimestamps.size > 50) {
    for (const [key, time] of recentErrorTimestamps.entries()) {
      if (now - time > 10000) {
        recentErrorTimestamps.delete(key);
      }
    }
  }

  try {
    isReportingInProgress = true;
    const body = {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
      userAgent: payload.userAgent || navigator.userAgent,
      url: payload.url || window.location.href,
    };

    // Dùng native fetch để không bị interceptors của axios can thiệp
    await fetch('/api/dev/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Không ném lỗi ra ngoài để tránh gây crash app khi backend chưa sẵn sàng
  } finally {
    isReportingInProgress = false;
  }
}

/**
 * Khởi tạo listener toàn cục cho Frontend (chỉ kích hoạt trong môi trường Development)
 */
export function initDevErrorReporter(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  // 1. Bắt lỗi runtime chưa được xử lý (Uncaught Exceptions)
  window.addEventListener('error', (event: ErrorEvent) => {
    // Bỏ qua nếu không có thông điệp lỗi hoặc là lỗi tải tài nguyên thẻ <img>/<script>
    if (!event.message) return;

    if (isIgnoredError(event.message, event.error?.stack, event.filename)) {
      return;
    }

    sendDevError({
      errorType: 'RUNTIME_ERROR',
      message: event.message,
      stack: event.error?.stack || '(No stack trace available)',
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
    });
  });

  // 2. Bắt lỗi Promise bị reject mà không có .catch() (Unhandled Rejections)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack = '';

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack || '';
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason && typeof reason === 'object') {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    if (isIgnoredError(message, stack)) {
      return;
    }

    sendDevError({
      errorType: 'UNHANDLED_PROMISE_REJECTION',
      message,
      stack: stack || '(No stack trace available)',
      url: window.location.href,
    });
  });

  console.info(
    '%c[DevErrorReporter]%c Global runtime error capture is active (Logs -> app_errors.log)',
    'color: #0284c7; font-weight: bold;',
    'color: inherit;'
  );
}
