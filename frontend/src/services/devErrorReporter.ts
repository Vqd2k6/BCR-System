/**
 * Dev Error Reporter Service
 * 
 * Tự động bắt toàn diện mọi loại lỗi phát sinh khi kiểm thử giao diện trong môi trường DEV:
 * 1. window.onerror & window.addEventListener('error', ..., true) (Uncaught JS Exceptions)
 * 2. Resource Loading Errors (Thẻ <img>, <script>, <link> bị lỗi 404/ERR_FAILED)
 * 3. window.onunhandledrejection & window.addEventListener('unhandledrejection') (Unhandled Promises)
 * 4. React Error Boundary (Lỗi crash render component)
 * 5. Axios API Interceptor (Mọi lỗi API 4xx, 5xx, 401, Network Error)
 * 6. console.error interceptor (Toàn bộ lỗi được in ra console bằng console.error)
 * 
 * Toàn bộ lỗi được lọc bỏ extension ngoại vi, chống spam debouncing và gửi về:
 * POST /api/dev/report-error -> ghi nối tiếp vào app_errors.log ở thư mục gốc dự án.
 */

export interface DevErrorPayload {
  errorType: 'RUNTIME_ERROR' | 'UNHANDLED_PROMISE_REJECTION' | 'REACT_ERROR_BOUNDARY' | 'API_ERROR' | 'CONSOLE_ERROR' | 'RESOURCE_ERROR' | 'CUSTOM_DEV_ERROR';
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  timestamp?: string;
  userAgent?: string;
  componentStack?: string;
}

// Bảng cache tạm để chống spam/lặp lại lỗi giống hệt nhau trong thời gian ngắn (debouncing)
const recentErrorTimestamps = new Map<string, number>();
const DEBOUNCE_WINDOW_MS = 1500;

// Cờ chống vòng lặp đệ quy nếu fetch báo cáo lỗi gặp trục trặc
let isReportingInProgress = false;

/**
 * Kiểm tra xem lỗi có thuộc diện ngoại vi (browser extension, hệ điều hành, ResizeObserver) cần bỏ qua không.
 */
export function isIgnoredError(message: string, stack?: string, source?: string): boolean {
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
    '200.js',
    "reading 'm_id'",
    'reading "m_id"',
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

  // 3. Lỗi từ chính endpoint report-error (tránh đệ quy vô hạn)
  if (
    normalizedMsg.includes('/api/dev/report-error') ||
    normalizedStack.includes('/api/dev/report-error') ||
    normalizedSource.includes('/api/dev/report-error')
  ) {
    return true;
  }

  // 4. Bỏ qua các log thông tin bình thường của Vite dev server và React DevTools info
  if (normalizedMsg.includes('[vite]') || normalizedMsg.includes('download the react devtools')) {
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

  // Kiểm tra lỗi ngoại vi cần bỏ qua
  if (isIgnoredError(payload.message, payload.stack, payload.source)) {
    return;
  }

  // Chống spam lặp cùng 1 lỗi (đối với tile bản đồ thì debounce 5 giây để tránh tràn log)
  const isMapTile = payload.message.includes('MAP_TILE_NETWORK_ERROR');
  const errorKey = isMapTile ? 'MAP_TILE_NETWORK_ERROR' : `${payload.errorType}:${payload.message.slice(0, 100)}:${payload.source || ''}:${payload.lineno || ''}`;
  const debounceTime = isMapTile ? 5000 : DEBOUNCE_WINDOW_MS;
  const now = Date.now();
  const lastTime = recentErrorTimestamps.get(errorKey);
  if (lastTime && now - lastTime < debounceTime) {
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
      userAgent: payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'),
      url: payload.url || (typeof window !== 'undefined' ? window.location.href : 'N/A'),
    };

    // Dùng native fetch để không bị interceptors của axios can thiệp
    const res = await fetch('/api/dev/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // In thông báo màu xanh trực quan trên DevTools console để người dùng biết chắc chắn lỗi đã được ghi
      originalConsoleLog(
        `%c[DevErrorReporter] 📝 Đã tự động ghi vào app_errors.log:%c ${payload.message.slice(0, 100)}`,
        'color: #059669; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;',
        'color: #047857; font-weight: normal;'
      );
    } else {
      originalConsoleWarn(
        `%c[DevErrorReporter] ⚠️ Không thể ghi vào app_errors.log (Backend trả về HTTP ${res.status})`,
        'color: #d97706; font-weight: bold;'
      );
    }
  } catch (err: any) {
    originalConsoleWarn(
      `%c[DevErrorReporter] ⚠️ Lỗi kết nối tới endpoint /api/dev/report-error: ${err?.message}`,
      'color: #d97706; font-weight: bold;'
    );
  } finally {
    isReportingInProgress = false;
  }
}

// Lưu tham chiếu nguyên bản của console trước khi hook
const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

/**
 * Khởi tạo listener toàn cục cho Frontend (chỉ kích hoạt trong môi trường Development)
 */
export function initDevErrorReporter(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  // Tránh gắn lặp nhiều lần nếu HMR reload
  if ((window as any).__metro2_dev_reporter_initialized) {
    return;
  }
  (window as any).__metro2_dev_reporter_initialized = true;

  // 1. Gắn window.onerror trực tiếp (Native Hook cấp cao nhất)
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = typeof message === 'string' ? message : (message as any)?.message || 'Uncaught Error';
    if (!isIgnoredError(msgStr, error?.stack, source)) {
      sendDevError({
        errorType: 'RUNTIME_ERROR',
        message: msgStr,
        stack: error?.stack || (error ? String(error) : '(No stack trace available)'),
        source: source || '',
        lineno: lineno,
        colno: colno,
        url: window.location.href,
      });
    }

    if (typeof prevOnError === 'function') {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // 2. Gắn window.addEventListener('error') ở CAPTURING PHASE (useCapture = true)
  // để bắt trước khi bất kỳ thư viện nào gọi stopPropagation()
  window.addEventListener(
    'error',
    (event: ErrorEvent | Event) => {
      // 2a. Nếu là lỗi tài nguyên (thẻ img, script, link css không tải được, vd: map tile, ảnh chụp hỏng link)
      const target = event.target as HTMLElement | null;
      if (target && 'tagName' in target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const src = (target as HTMLImageElement).src || (target as HTMLImageElement).currentSrc || (target as HTMLScriptElement).src || (target as HTMLLinkElement).href;
        if (src && !isIgnoredError(src)) {
          // Nếu là lỗi tải tile bản đồ OpenStreetMap (net::ERR_CONNECTION_REFUSED)
          if (src.includes('tile.openstreetmap.org') || src.includes('/tile/')) {
            sendDevError({
              errorType: 'RESOURCE_ERROR',
              message: `[MAP_TILE_NETWORK_ERROR] Máy chủ bản đồ OpenStreetMap từ chối kết nối (net::ERR_CONNECTION_REFUSED): ${src}`,
              source: src,
              url: window.location.href,
            });
            return;
          }

          sendDevError({
            errorType: 'RESOURCE_ERROR',
            message: `[RESOURCE_LOAD_FAILED] Không thể tải tài nguyên (${target.tagName}): ${src}`,
            source: src,
            url: window.location.href,
          });
        }
        return;
      }

      // 2b. Nếu là ErrorEvent runtime thông thường
      const errEvent = event as ErrorEvent;
      if (errEvent.message && !isIgnoredError(errEvent.message, errEvent.error?.stack, errEvent.filename)) {
        sendDevError({
          errorType: 'RUNTIME_ERROR',
          message: errEvent.message,
          stack: errEvent.error?.stack || '(No stack trace available)',
          source: errEvent.filename,
          lineno: errEvent.lineno,
          colno: errEvent.colno,
          url: window.location.href,
        });
      }
    },
    true
  );

  // 3. Gắn window.onunhandledrejection trực tiếp
  const prevOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = function (event: PromiseRejectionEvent) {
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

    if (!isIgnoredError(message, stack)) {
      sendDevError({
        errorType: 'UNHANDLED_PROMISE_REJECTION',
        message,
        stack: stack || '(No stack trace available)',
        url: window.location.href,
      });
    }

    if (typeof prevOnRejection === 'function') {
      return (prevOnRejection as any).call(window, event);
    }
  };

  // 4. Hook console.error TOÀN DIỆN (bắt mọi lỗi được log ra console mà không lọc case-sensitive)
  console.error = function (...args: any[]) {
    originalConsoleError.apply(console, args);

    try {
      const errorObj = args.find((a) => a instanceof Error);
      const combinedMsg = args
        .map((a) => {
          if (typeof a === 'string') return a;
          if (a instanceof Error) return a.message;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');

      // Bỏ qua nếu là chuỗi rỗng hoặc thuộc danh sách extension ngoại vi
      if (combinedMsg.trim() && !isIgnoredError(combinedMsg, errorObj?.stack)) {
        sendDevError({
          errorType: 'CONSOLE_ERROR',
          message: combinedMsg.slice(0, 1000),
          stack: errorObj?.stack || '(From console.error call)',
          url: window.location.href,
        });
      }
    } catch (_e) {}
  };

  // 5. Cung cấp hàm test nhanh trên DevTools Console: window.__triggerTestError()
  (window as any).__triggerTestError = (msg?: string) => {
    const errMsg = msg || 'Manual test runtime error from DevTools Console';
    originalConsoleLog('[DevErrorReporter] 🚀 Triggering test error:', errMsg);
    setTimeout(() => {
      throw new Error(errMsg);
    }, 0);
  };
  (window as any).__reportDevError = sendDevError;

  originalConsoleLog(
    '%c[DevErrorReporter]%c ✅ Hệ thống bắt lỗi tự động đang hoạt động! (Logs -> app_errors.log). Test gõ: window.__triggerTestError()',
    'color: #0284c7; font-weight: bold; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;',
    'color: #0369a1;'
  );
}
