import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { sendDevError } from './devErrorReporter';
import { AUTH_UNAUTHORIZED_EVENT, getAccessToken, refreshAccessToken } from './authSession';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
}

const isAuthEndpoint = (url?: string): boolean =>
  Boolean(url && (url.includes('/auth/login') || url.includes('/auth/refresh-token') || url.includes('/auth/logout')));

const resolveBaseUrl = (): string => {
  let envUrl = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  if (!envUrl) return '/api/v1';
  // Tự động xử lý nếu người dùng vô tình dán cả "VITE_API_BASE_URL=https://..." vào ô Value
  if (envUrl.includes('=')) {
    envUrl = envUrl.slice(envUrl.indexOf('=') + 1).trim();
  }
  // Loại bỏ dấu nháy kép hoặc đơn nếu có
  envUrl = envUrl.replace(/^["']|["']$/g, '').trim();
  return envUrl || '/api/v1';
};

export const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 300s timeout (5 phút) chịu tải nạp bản đồ lớn và Render Cold-start
  adapter: typeof fetch !== 'undefined' ? 'fetch' : undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Tự động đính kèm JWT Bearer Token & Xóa Content-Type cho FormData
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Nếu body là FormData, bắt buộc xóa Content-Type để Fetch / Trình duyệt tự sinh multipart boundary chuẩn
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

interface ApiErrorData {
  detail?: string | Record<string, unknown>;
  message?: string;
  title?: string;
  [key: string]: unknown;
}

// Response Interceptor: Ghi log lỗi có cấu trúc (RFC 7807) & Giữ nguyên Promise.reject để UI xử lý
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorData>) => {
    // Request responseType 'blob' (tải PDF) nhận lỗi problem+json dưới dạng Blob: đọc lại để UI và log thấy `detail` thật.
    const rawData: unknown = error.response?.data;
    if (error.response && typeof Blob !== 'undefined' && rawData instanceof Blob && /json/i.test(rawData.type || '')) {
      try {
        const parsed: unknown = JSON.parse(await rawData.text());
        if (parsed && typeof parsed === 'object') {
          error.response.data = parsed as ApiErrorData;
        }
      } catch (parseErr: unknown) {
        console.error('[Api:blobError] Không đọc được problem+json từ Blob:', parseErr);
      }
    }

    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const data = error.response?.data;
    const detailMsg = data?.detail || data?.message || data?.title || error.message;

    // Bỏ qua cảnh báo lỗi cho endpoint kiểm tra bản nháp nếu là 404 (chưa có bản nháp)
    const isDraftCheck404 = url?.includes('/surveys/draft/') && status === 404;

    // Tự động chuyển tiếp toàn bộ lỗi API về dev reporter nếu trong môi trường DEV
    if (status && status >= 400 && !isDraftCheck404) {
      const msgStr = typeof detailMsg === 'object' ? JSON.stringify(detailMsg) : String(detailMsg);
      sendDevError({
        errorType: 'API_ERROR',
        message: `[API ${status}] ${method} ${url}: ${msgStr}`,
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : '',
      });
    } else if (!status && !error.message?.includes('canceled')) {
      sendDevError({
        errorType: 'API_ERROR',
        message: `[API NETWORK ERROR] ${method} ${url}: Không thể kết nối Backend (Port 4000)`,
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : '',
      });
    }

    if (status === 401) {
      const msgStr = typeof detailMsg === 'string' ? detailMsg : 'Phiên đăng nhập đã hết hạn hoặc tài khoản đã bị thu hồi quyền truy cập.';
      console.warn(
        `%c[API AUTH 401] ${method} ${url}%c -> Token hết hạn hoặc chưa đăng nhập. Chi tiết: ${msgStr}`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
      const sentAuth = error.config?.headers?.Authorization;
      const currentToken = getAccessToken();
      const originalConfig = error.config as RetriableRequestConfig | undefined;

      // Request đi kèm token còn hiệu lực trên máy: thử làm mới access token một lần rồi gửi lại
      if (sentAuth && currentToken && sentAuth === `Bearer ${currentToken}` && originalConfig && !originalConfig._authRetried && !isAuthEndpoint(url)) {
        originalConfig._authRetried = true;
        const refreshed = await refreshAccessToken(API_BASE_URL);
        if (refreshed.kind === 'OK') {
          console.warn(`[Api:authRefresh] Đã làm mới token, gửi lại ${method} ${url}`);
          originalConfig.headers.Authorization = `Bearer ${refreshed.accessToken}`;
          return api.request(originalConfig);
        }
        if (refreshed.kind === 'UNAVAILABLE') {
          // Máy chủ tạm lỗi khi làm mới: giữ phiên + nháp, request này thất bại, lượt lưu sau sẽ thử lại
          console.error(`[Api:authRefresh] Máy chủ tạm thời không làm mới được token, giữ phiên. ${method} ${url}`);
          return Promise.reject(error);
        }
      }

      // Request gửi bằng token cũ trong lúc request khác vừa làm mới token: gửi lại bằng token mới
      if (sentAuth && currentToken && sentAuth !== `Bearer ${currentToken}` && originalConfig && !originalConfig._authRetried && !isAuthEndpoint(url)) {
        originalConfig._authRetried = true;
        originalConfig.headers.Authorization = `Bearer ${currentToken}`;
        return api.request(originalConfig);
      }

      // Không khóa phiên lần nữa khi:
      // - request đi ra không kèm token (phiên đã bị khóa trước đó / khách chưa đăng nhập): giữ nguyên lý do gốc;
      // - request gửi bằng token cũ trong khi token đã được thay (vừa đổi mật khẩu / vừa làm mới).
      const sentWithoutToken = !sentAuth;
      const tokenAlreadyCleared = !currentToken;
      const isStaleToken = Boolean(sentAuth && currentToken && sentAuth !== `Bearer ${currentToken}`);
      if (typeof window !== 'undefined' && !isAuthEndpoint(url) && !sentWithoutToken && !tokenAlreadyCleared && !isStaleToken) {
        window.dispatchEvent(
          new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
            detail: {
              message: msgStr,
              url: url || '',
            },
          })
        );
      }
    } else if (status && status >= 400 && status < 500) {
      if (!isDraftCheck404) {
        console.warn(
          `%c[API CLIENT ERROR ${status}] ${method} ${url}%c -> ${detailMsg}`,
          'color: #ef4444; font-weight: bold;',
          'color: inherit;',
          data?.errors || data
        );
      }
    } else if (status && status >= 500) {
      console.error(
        `%c[API SERVER ERROR ${status}] ${method} ${url}%c -> Lỗi máy chủ: ${detailMsg}`,
        'color: #dc2626; font-weight: bold;',
        'color: inherit;',
        data
      );
    } else {
      console.error(
        `%c[API NETWORK ERROR] ${method} ${url}%c -> Không thể kết nối Backend (Port 4000). Kiểm tra server!`,
        'color: #dc2626; font-weight: bold;',
        'color: inherit;'
      );
    }

    return Promise.reject(error);
  }
);

export default api;

