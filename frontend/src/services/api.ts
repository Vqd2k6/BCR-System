import axios, { AxiosError } from 'axios';
import { sendDevError } from './devErrorReporter';

const resolveBaseUrl = (): string => {
  let envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!envUrl) return '/api/v1';
  // Tự động xử lý nếu người dùng vô tình dán cả "VITE_API_BASE_URL=https://..." vào ô Value
  if (envUrl.includes('=')) {
    envUrl = envUrl.slice(envUrl.indexOf('=') + 1).trim();
  }
  // Loại bỏ dấu nháy kép hoặc đơn nếu có
  envUrl = envUrl.replace(/^["']|["']$/g, '').trim();
  return envUrl || '/api/v1';
};

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 120000, // 120s timeout chịu tải Render Free cold-start và upload khảo sát
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Tự động đính kèm JWT Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('metro2_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Ghi log lỗi có cấu trúc (RFC 7807) & Giữ nguyên Promise.reject để UI xử lý
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const data = error.response?.data;
    const detailMsg = data?.detail || data?.message || data?.title || error.message;

    // Tự động chuyển tiếp toàn bộ lỗi API về dev reporter nếu trong môi trường DEV
    if (status && status >= 400) {
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
      console.warn(
        `%c[API AUTH 401] ${method} ${url}%c -> Token hết hạn hoặc chưa đăng nhập. Chi tiết: ${detailMsg}`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
    } else if (status && status >= 400 && status < 500) {
      console.warn(
        `%c[API CLIENT ERROR ${status}] ${method} ${url}%c -> ${detailMsg}`,
        'color: #ef4444; font-weight: bold;',
        'color: inherit;',
        data?.errors || data
      );
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

