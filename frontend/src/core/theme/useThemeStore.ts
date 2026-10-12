import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  resolveTheme,
  subscribeSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './applyTheme';

interface ThemeState {
  /** Lựa chọn của người dùng (lưu theo thiết bị). Mặc định: 'light'. */
  preference: ThemePreference;
  /** Theme thực tế đang hiển thị sau khi giải 'system'. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Gọi lại khi OS đổi theme (chỉ có tác dụng nếu preference = 'system'). */
  syncWithSystem: () => void;
}

/** Storage an toàn: Safari Private Mode có thể chặn localStorage → fallback Light, có log. */
const safeStorage = createJSONStorage<Pick<ThemeState, 'preference'>>(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (err: unknown) {
      console.error('[Theme] Không đọc được theme đã lưu, dùng chế độ Sáng:', err);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (err: unknown) {
      console.error('[Theme] Không lưu được lựa chọn theme:', err);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (err: unknown) {
      console.error('[Theme] Không xoá được theme đã lưu:', err);
    }
  },
}));

const readInitialPreference = (): ThemePreference => {
  try {
    if (typeof localStorage === 'undefined') return 'light';
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return 'light';
    const parsed = JSON.parse(raw);
    const p = parsed?.state?.preference;
    if (isThemePreference(p)) return p;
    return 'light';
  } catch (err: unknown) {
    console.error('[Theme] Lỗi đọc initial preference:', err);
    return 'light';
  }
};

const initialPref = readInitialPreference();
const initialResolved = resolveTheme(initialPref);

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: initialPref,
      resolved: initialResolved,
      setPreference: (preference) => {
        const resolved = resolveTheme(preference);
        applyTheme(resolved, { animate: true });
        set({ preference, resolved });
      },
      syncWithSystem: () => {
        const { preference, resolved } = get();
        if (preference !== 'system') return;
        const next = resolveTheme('system');
        if (next !== resolved) {
          applyTheme(next, { animate: true });
          set({ resolved: next });
        }
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 0,
      storage: safeStorage,
      partialize: (state) => ({ preference: state.preference }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as { preference?: unknown };
        const preference = isThemePreference(raw.preference) ? raw.preference : current.preference;
        return { ...current, preference, resolved: resolveTheme(preference) };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[Theme] Lỗi khôi phục theme đã lưu:', error);
          return;
        }
        if (state) applyTheme(state.resolved);
      },
    }
  )
);

let systemUnsubscribe: (() => void) | null = null;

/** Khởi tạo 1 lần tại main.tsx: áp theme hiện tại + nghe thay đổi theme của OS. */
export const initThemeSystemListener = (): void => {
  const { resolved } = useThemeStore.getState();
  applyTheme(resolved);
  if (systemUnsubscribe) return;
  systemUnsubscribe = subscribeSystemTheme(() => {
    useThemeStore.getState().syncWithSystem();
  });
};
