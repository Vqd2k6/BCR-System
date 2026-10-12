import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '@/core/theme/useThemeStore';
import type { ThemePreference } from '@/core/theme/applyTheme';

interface ThemeSwitcherProps {
  /** Hiển thị nhãn tiêu đề "Giao diện" phía trên. */
  showLabel?: boolean;
  /** Ẩn chữ, chỉ hiện icon (dùng khi không gian hẹp, VD sidebar thu gọn). */
  iconOnly?: boolean;
  className?: string;
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', Icon: Sun },
  { value: 'dark', label: 'Tối', Icon: Moon },
  { value: 'system', label: 'Hệ thống', Icon: Monitor },
];

/**
 * Công tắc giao diện Sáng / Tối / Theo hệ thống (Rule §7).
 * Đặt trong menu cá nhân (avatar) của mỗi role. Chỉ dùng class Tailwind → tự đổi màu theo theme.
 */
export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ showLabel = true, iconOnly = false, className = '' }) => {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Giao diện</div>
      )}
      <div
        role="radiogroup"
        aria-label="Chọn giao diện sáng hoặc tối"
        className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              id={`theme-option-${value}`}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={(e) => {
                e.stopPropagation();
                setPreference(value);
              }}
              className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all active:scale-95 ${
                active
                  ? 'bg-white text-sky-700 shadow-sm border border-slate-200'
                  : 'text-slate-500 border border-transparent hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <Icon size={13} strokeWidth={2.4} />
              {!iconOnly && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
