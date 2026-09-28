import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Map,
  FileSpreadsheet,
  List,
  LogOut,
  User,
  Phone,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { UserProfileModal } from '../profile/UserProfileModal';

interface Props {
  activeTab: string;
  onChangeTab: (tab: any) => void;
}

export const AdminTopNav: React.FC<Props> = ({ activeTab, onChangeTab }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo & System Brand */}
        <div className="flex items-center gap-3">
          <div className="h-8 flex items-center justify-center bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
            <img
              src="/logo.png"
              alt="MITECHYX Logo"
              className="h-6 max-w-[80px] object-contain"
            />
          </div>

          <div>
            <div className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5">
              <span className="text-emerald-400">METRO 2</span>
              <span className="text-slate-400 hidden sm:inline">|</span>
              <span className="hidden sm:inline">
                {isSuperAdmin ? 'TRUNG TÂM ĐIỀU HÀNH MAUR' : 'PHÂN HỆ QUẢN TRỊ ZONE'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium hidden md:block">
              Building Condition Survey & Structural Assessment Platform
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeTab('admin-export')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'admin-export'
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>{isSuperAdmin ? 'Quản Trị & Xuất BC' : 'Dashboard Zone'}</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'map'
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Map size={15} />
            <span>Bản đồ số GIS</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'home'
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <List size={15} />
            <span>Danh sách Thửa đất</span>
          </button>
        </nav>

        {/* User Profile Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-900 font-black text-xs flex items-center justify-center border-2 border-slate-700 shadow-sm">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-bold text-slate-100 leading-tight">
                {user?.fullName}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold leading-tight mt-0.5">
                {isSuperAdmin ? 'Super Administrator' : user?.assignedZoneId ? `${user.assignedZoneId} Admin` : 'Zone Admin'}
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <div className="font-bold text-sm text-slate-900">{user?.fullName}</div>
                <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                  {isSuperAdmin ? 'Lãnh đạo Ban QLDA MAUR' : 'Tổ Trưởng / Điều Phối Viên'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Building size={12} />
                  <span>
                    Khu vực: <strong>{isSuperAdmin ? 'Toàn tuyến (22 Zones)' : user?.assignedZoneId || 'Zone_01'}</strong>
                  </span>
                </div>
                {user?.phone && (
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Phone size={12} />
                    <span>SĐT: {user.phone}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfileModal(true);
                }}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-slate-200"
              >
                <User size={14} className="text-slate-500" />
                <span>Cập nhật Thông tin cá nhân</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-red-200"
              >
                <LogOut size={14} />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </header>
  );
};
