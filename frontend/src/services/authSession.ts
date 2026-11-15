/**
 * Khóa lưu phiên đăng nhập + ghi nhận lý do khóa phiên + làm mới access token.
 * Dùng chung cho `services/api.ts` và `context/AuthContext.tsx` (tránh import vòng).
 */

export const ACCESS_TOKEN_KEY = 'metro2_access_token';
export const REFRESH_TOKEN_KEY = 'metro2_refresh_token';
export const USER_PROFILE_KEY = 'metro2_user_profile';
export const LOCKOUT_REASON_KEY = 'metro2_auth_lockout_reason';

export const AUTH_UNAUTHORIZED_EVENT = 'metro2:auth-unauthorized';
export const AUTH_TOKEN_REFRESHED_EVENT = 'metro2:auth-token-refreshed';

export interface LockoutRecord {
  reason: string;
  url: string;
  at: string;
}

const readStorage = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch (err: unknown) {
    console.error(`[authSession:readStorage] Không đọc được ${key}:`, err);
    return null;
  }
};

export const getAccessToken = (): string | null => readStorage(localStorage, ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null => readStorage(localStorage, REFRESH_TOKEN_KEY);

/** Đọc lý do khóa phiên (tương thích bản cũ lưu chuỗi thuần) */
export function readLockoutRecord(): LockoutRecord | null {
  const raw = readStorage(sessionStorage, LOCKOUT_REASON_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof (parsed as LockoutRecord).reason === 'string') {
      const r = parsed as LockoutRecord;
      return { reason: r.reason, url: typeof r.url === 'string' ? r.url : '', at: typeof r.at === 'string' ? r.at : '' };
    }
  } catch (_err: unknown) {
    // Bản cũ lưu chuỗi thuần, không phải JSON: dùng nguyên chuỗi làm lý do
    console.warn('[authSession:readLockoutRecord] Lý do khóa dạng chuỗi cũ:', _err);
  }
  return { reason: raw, url: '', at: '' };
}

/**
 * Ghi lý do khóa phiên. Chỉ ghi lý do ĐẦU TIÊN của lượt khóa: các request chạy sau
 * (không còn token) không được ghi đè nguyên nhân gốc.
 */
export function recordLockoutOnce(reason: string, url: string): void {
  try {
    if (sessionStorage.getItem(LOCKOUT_REASON_KEY)) return;
    const record: LockoutRecord = { reason, url, at: new Date().toISOString() };
    sessionStorage.setItem(LOCKOUT_REASON_KEY, JSON.stringify(record));
    console.warn('[authSession:lockout] Khóa phiên:', record);
  } catch (err: unknown) {
    console.error('[authSession:recordLockoutOnce] Không lưu được lý do khóa phiên:', err);
  }
}

export function clearLockoutRecord(): void {
  try {
    sessionStorage.removeItem(LOCKOUT_REASON_KEY);
  } catch (err: unknown) {
    console.error('[authSession:clearLockoutRecord] Không xóa được lý do khóa phiên:', err);
  }
}

export function storeTokens(accessToken: string, refreshToken?: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
}

interface RefreshResponse {
  success?: boolean;
  data?: { accessToken?: string };
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Xin access token mới bằng refresh token. Nhiều request 401 cùng lúc dùng chung một lượt gọi.
 * Trả về token mới, hoặc null nếu không có refresh token / máy chủ từ chối (khóa, thu hồi, hết hạn).
 */
export function refreshAccessToken(baseURL: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  refreshInFlight = (async () => {
    try {
      // fetch trực tiếp, không qua instance `api` để tránh vòng lặp interceptor
      const res = await fetch(`${baseURL.replace(/\/$/, '')}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        console.warn(`[authSession:refreshAccessToken] Máy chủ từ chối làm mới token (HTTP ${res.status})`);
        return null;
      }
      const body = (await res.json()) as RefreshResponse;
      const accessToken = body?.data?.accessToken;
      if (!accessToken) {
        console.error('[authSession:refreshAccessToken] Phản hồi làm mới token thiếu accessToken:', body);
        return null;
      }
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      window.dispatchEvent(new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT, { detail: { accessToken } }));
      return accessToken;
    } catch (err: unknown) {
      console.error('[authSession:refreshAccessToken] Lỗi mạng khi làm mới token:', err);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
