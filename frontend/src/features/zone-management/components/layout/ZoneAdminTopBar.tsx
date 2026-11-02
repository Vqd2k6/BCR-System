import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { ForensicImageLabModal } from '../../../image-lab/ForensicImageLabModal';
import { ZoneAdminAccountMenu, getAccountZoneLabel } from './ZoneAdminAccountMenu';
import type { UserProfile } from '../../../../context/AuthContext';

interface Props {
  title: string;
  subtitle?: string;
  selectedZone: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onAlertClick?: () => void;
  user: UserProfile | null;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const ZoneAdminTopBar: React.FC<Props> = ({
  title,
  selectedZone,
  user,
  onOpenChangePassword,
  onLogout,
}) => {
  const [showImageLabModal, setShowImageLabModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const displayName = user?.fullName || 'Zone Admin';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAccountMenu]);

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-xs z-20">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs font-bold text-slate-400 hidden sm:inline">Phân hệ Quản trị Zone</span>
        <ChevronRight size={14} className="text-slate-300 hidden sm:inline" />
        <div className="flex items-center gap-2 truncate">
          <h1 className="text-sm sm:text-base font-black text-slate-800 truncate">
            {title}
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            {selectedZone === 'ALL' ? 'Toàn tuyến' : selectedZone}
          </span>
        </div>
      </div>

      {/* Nút mở Module Test Xử Lý Ảnh Vết Nứt (Forensic Image Lab Sandbox) */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowImageLabModal(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
          title="Mở Phòng thí nghiệm kiểm định thuật toán làm rõ vết nứt & khử tối ảnh"
        >
          <FlaskConical size={15} className="text-indigo-600" />
          <span>Test Xử Lý Ảnh Nứt</span>
        </button>

        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAccountMenu((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title={displayName}
            aria-expanded={showAccountMenu}
          >
            <span className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {displayName.charAt(0)}
            </span>
            <span className="text-left hidden lg:block max-w-40">
              <span className="block text-xs font-bold text-slate-800 leading-tight truncate">{displayName}</span>
              <span className="block text-[10px] text-slate-500 font-mono leading-tight mt-0.5 truncate">
                {getAccountZoneLabel(user)}
              </span>
            </span>
          </button>

          {showAccountMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
              <ZoneAdminAccountMenu
                user={user}
                onOpenChangePassword={() => {
                  setShowAccountMenu(false);
                  onOpenChangePassword();
                }}
                onLogout={() => {
                  setShowAccountMenu(false);
                  onLogout();
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ForensicImageLabModal
        isOpen={showImageLabModal}
        onClose={() => setShowImageLabModal(false)}
      />
    </header>
  );
};
