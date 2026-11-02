import React from 'react';
import { Building, KeyRound, LogOut, Phone } from 'lucide-react';
import { ThemeSwitcher } from '../../../../components/common/ThemeSwitcher';
import type { UserProfile } from '../../../../context/AuthContext';

type AccountZoneUser = Pick<UserProfile, 'role' | 'assignedZoneId'> | null;

/** Nhãn khu vực phân công, không suy đoán zone khi tài khoản chưa được gán. */
export function getAccountZoneLabel(user: AccountZoneUser): string {
  if (user?.role === 'SUPER_ADMIN') return 'Toàn tuyến';
  const zone = (user?.assignedZoneId || '').trim();
  if (!zone) return 'Chưa được phân khu';
  const normalized = zone.toUpperCase();
  return normalized === 'ALL' || normalized === 'ALL_ZONES' ? 'Toàn tuyến' : zone;
}

interface Props {
  user: UserProfile | null;
  onOpenChangePassword: () => void;
  onLogout?: () => void;
  /** Chỉ bật khi vị trí đặt menu chưa có sẵn ThemeSwitcher. */
  showThemeSwitcher?: boolean;
}

/** Thông tin tài khoản chỉ đọc: Zone Admin chỉ được tự đổi mật khẩu. */
export const ZoneAdminAccountMenu: React.FC<Props> = ({
  user,
  onOpenChangePassword,
  onLogout,
  showThemeSwitcher = false,
}) => {
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-3">
      <div className="border-b border-slate-100 pb-2 space-y-1">
        <div className="font-bold text-sm text-slate-900 truncate">{user?.fullName}</div>
        <span
          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
            isSuperAdmin
              ? 'bg-purple-950 text-purple-300 border-purple-700'
              : 'bg-amber-950 text-amber-300 border-amber-700'
          }`}
        >
          {isSuperAdmin ? 'Super Admin' : 'Zone Admin'}
        </span>
        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <Building size={12} className="shrink-0" />
          <span>Khu vực:</span>
          <span className="px-1.5 py-0.5 rounded border bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold truncate">
            {getAccountZoneLabel(user)}
          </span>
        </div>
        {user?.phone && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Phone size={12} className="shrink-0" />
            <span>SĐT: {user.phone}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenChangePassword}
        className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-sky-200 cursor-pointer"
      >
        <KeyRound size={14} className="text-sky-600" />
        <span>Đổi mật khẩu tài khoản</span>
      </button>

      {showThemeSwitcher && <ThemeSwitcher className="pt-2 border-t border-slate-100" />}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-red-200 cursor-pointer"
        >
          <LogOut size={14} />
          <span>Đăng xuất tài khoản</span>
        </button>
      )}
    </div>
  );
};
