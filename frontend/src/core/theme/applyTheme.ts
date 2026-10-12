/**
 * Áp dụng theme lên <html> — Dark Mode toàn cục (Rule §7).
 * - Bật/tắt class `dark` + `color-scheme` trên documentElement.
 * - Đồng bộ <meta name="theme-color"> để thanh trạng thái PWA cùng tông.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'metro2_theme_preference';

/** Light giữ nguyên giá trị cũ trong index.html (#0f172a) để không đổi hành vi thanh trạng thái hiện tại. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#0f172a',
  dark: '#0b1222',
};

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const getSystemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference === 'system') return getSystemPrefersDark() ? 'dark' : 'light';
  return preference;
};

let transitionTimer: number | undefined;

export const applyTheme = (resolved: ResolvedTheme, options: { animate?: boolean } = {}): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolved === 'dark';

  if (options.animate) {
    root.classList.add('theme-transition');
    if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transition');
      transitionTimer = undefined;
    }, 320);
  }

  root.classList.toggle('dark', isDark);
  root.style.colorScheme = resolved;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
};

/**
 * Lắng nghe thay đổi theme của hệ điều hành (chỉ có tác dụng khi preference = 'system').
 * Trả về hàm huỷ đăng ký.
 */
export const subscribeSystemTheme = (onChange: (prefersDark: boolean) => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(SYSTEM_DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
};
