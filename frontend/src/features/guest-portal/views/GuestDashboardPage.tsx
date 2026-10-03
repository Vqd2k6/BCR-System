import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { GisParcel } from '../../../components/gis/shared/types';
import { LeafletSweepMap } from '../../../components/gis/LeafletSweepMap';
import {
  computeGuestKpis,
  computeGuestBraStats,
  maskParcelClientPii,
  BraRiskLevel,
} from '../utils/guestPortalHelpers';
import { GuestKpiSummaryCard } from '../components/GuestKpiSummaryCard';
import { GuestBraDonutChart } from '../components/GuestBraDonutChart';
import { GuestParcelListTable } from '../components/GuestParcelListTable';
import { GuestFocusedParcelCard } from '../components/GuestFocusedParcelCard';
import { GuestMapThematicToggle } from '../components/GuestMapThematicToggle';
import {
  ShieldCheck,
  LogOut,
  RefreshCw,
  MapPin,
  ChevronDown,
} from 'lucide-react';

interface GuestDashboardPageProps {
  parcels: GisParcel[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onRefreshParcels?: () => void;
  onStartSurveyDetail: (parcel: GisParcel, readOnly: boolean) => void;
}

const AVAILABLE_ZONES = Array.from({ length: 22 }, (_, i) => {
  const num = (i + 1).toString().padStart(2, '0');
  return `ZONE_${num}`;
});

export const GuestDashboardPage: React.FC<GuestDashboardPageProps> = ({
  parcels,
  selectedZone,
  onSelectZone,
  onRefreshParcels,
  onStartSurveyDetail,
}) => {
  const { user, logout } = useAuth();

  // State quản lý bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [braFilter, setBraFilter] = useState<BraRiskLevel | 'ALL'>('ALL');
  const [activeParcel, setActiveParcel] = useState<GisParcel | null>(null);
  const [thematicMode, setThematicMode] = useState<'WORKFLOW' | 'BRA_RISK'>('WORKFLOW');

  // Lọc zone hợp lệ dựa trên phân công của user
  const isAssignedSpecificZone = Boolean(
    user?.assignedZoneId &&
    user.assignedZoneId !== 'ALL_ZONES' &&
    user.assignedZoneId.trim() !== ''
  );

  // Nếu user bị gán zone cụ thể mà selectedZone chưa khớp, tự động chuyển
  useEffect(() => {
    if (isAssignedSpecificZone && user?.assignedZoneId) {
      const normalized = user.assignedZoneId.toUpperCase();
      if (selectedZone !== normalized) {
        onSelectZone(normalized);
      }
    }
  }, [isAssignedSpecificZone, user?.assignedZoneId, selectedZone, onSelectZone]);

  // Client-side PII Masking: Bảo vệ 2 lớp ngăn rò rỉ dữ liệu nhạy cảm
  const maskedParcels: GisParcel[] = useMemo(() => {
    return parcels.map(maskParcelClientPii);
  }, [parcels]);

  // Thống kê KPIs tiến độ khảo sát
  const kpiStats = useMemo(() => {
    return computeGuestKpis(maskedParcels);
  }, [maskedParcels]);

  // Thống kê cấp độ rủi ro BRA
  const braStats = useMemo(() => {
    return computeGuestBraStats(maskedParcels);
  }, [maskedParcels]);

  // Tự động giữ activeParcel nếu vẫn nằm trong list, hoặc fallback
  useEffect(() => {
    if (activeParcel) {
      const found = maskedParcels.find((p) => p.id === activeParcel.id);
      if (found) {
        setActiveParcel(found);
      }
    } else if (maskedParcels.length > 0) {
      setActiveParcel(maskedParcels[0]);
    }
  }, [maskedParcels]);

  const handleSelectParcel = (parcel: GisParcel) => {
    setActiveParcel(parcel);
  };

  const handleOpenDetailModal = (parcel: GisParcel) => {
    // Mở SurveyPhase1Page với cờ readOnly: true (Triple-Lock Read-Only)
    onStartSurveyDetail(parcel, true);
  };

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* ─── 1. TOP EXECUTIVE HEADER ─── */}
      <header className="h-16 bg-slate-900 text-white px-5 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0 z-30">
        {/* Brand & Official Project Logo */}
        <div className="flex items-center gap-3">
          {/* Logo chính thức của dự án Metro 2 */}
          <div className="h-10 px-2.5 py-1 bg-white/10 backdrop-blur-xs rounded-xl border border-white/15 flex items-center justify-center shadow-xs">
            <img
              src="/logo.png"
              alt="Logo Dự Án Tuyến Metro Số 2"
              className="h-7 max-w-[100px] object-contain"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>DỰ ÁN TUYẾN METRO SỐ 2</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                  Bến Thành – Tham Lương
                </span>
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              Ban Quản Lý Đường Sắt Đô Thị (MAUR) • Hệ Thống Khảo Sát Hiện Trạng BCR Phase 1
            </p>
          </div>
        </div>

        {/* Center: Zone Selector (Chủ đầu tư chọn khu vực giám sát) */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 shadow-2xs">
          <MapPin size={15} className="text-blue-400 shrink-0" />
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Khu vực:</span>
          {isAssignedSpecificZone ? (
            <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
              {selectedZone} (Được phân công)
            </span>
          ) : (
            <div className="relative">
              <select
                aria-label="Chọn khu vực giám sát"
                value={selectedZone}
                onChange={(e) => onSelectZone(e.target.value)}
                className="appearance-none bg-slate-900 text-xs font-bold text-white pl-2 pr-7 py-1 rounded-lg border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
              >
                {AVAILABLE_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone} (Km 0+000 - 11+042)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}

          {onRefreshParcels && (
            <button
              type="button"
              onClick={onRefreshParcels}
              title="Làm mới dữ liệu từ máy chủ"
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {/* Right: User Profile & Security Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/80 px-3 py-1.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>{user?.username || 'Chủ Đầu Tư MAUR'}</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                  GUEST
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>Ban Quản lý ĐSĐT</span>
                <span>•</span>
                <span className="text-slate-400 font-mono">Chế độ View-Only</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Đăng xuất khỏi hệ thống"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-300 border border-slate-700 hover:border-red-800/60 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Thoát</span>
          </button>
        </div>
      </header>

      {/* ─── 2. SPLIT-SCREEN MAIN CONTENT ─── */}
      <div className="flex flex-1 w-full overflow-hidden">
        {/* ─── LEFT PANEL (42% Width): Executive Dashboard & Parcel List ─── */}
        <aside className="w-[42%] min-w-[420px] max-w-[560px] h-full flex flex-col bg-slate-50 border-r border-slate-200/90 shadow-xs shrink-0 overflow-hidden z-10">
          {/* Scrollable Container for KPI, Donut, Table */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* 2.1 KPI Tiến Độ Tổng Thể (Được thiết kế 3 cột thoáng, không bị cắt chữ) */}
            <GuestKpiSummaryCard
              stats={kpiStats}
              selectedFilter={statusFilter}
              onFilterChange={(s) => setStatusFilter(s)}
            />

            {/* 2.2 Biểu Đồ BRA Donut Chart */}
            <GuestBraDonutChart
              stats={braStats}
              selectedRiskFilter={braFilter}
              onSelectRiskFilter={(risk) => setBraFilter(risk)}
            />

            {/* 2.3 Bảng Danh Sách Thửa Đất (Chỉ render 50 mục đầu + Nút tải thêm) */}
            <GuestParcelListTable
              parcels={maskedParcels}
              activeParcel={activeParcel}
              onSelectParcel={handleSelectParcel}
              statusFilter={statusFilter}
              riskFilter={braFilter}
            />
          </div>

          {/* 2.4 Bottom Pinned: Focused Parcel Detail Card */}
          {activeParcel && (
            <div className="p-3 bg-white border-t border-slate-200 shadow-md shrink-0">
              <GuestFocusedParcelCard
                parcel={activeParcel}
                onClose={() => setActiveParcel(null)}
                onOpenSurveyDetail={handleOpenDetailModal}
              />
            </div>
          )}
        </aside>

        {/* ─── RIGHT PANEL (58% Width): Interactive GIS Map ─── */}
        <section className="flex-1 h-full relative overflow-hidden bg-slate-200">
          {/* Floating Map Thematic Switcher */}
          <div className="absolute top-4 left-4 z-[1000]">
            <GuestMapThematicToggle
              thematicMode={thematicMode}
              onChangeMode={setThematicMode}
            />
          </div>

          {/* Leaflet GIS Map: Ẩn hoàn toàn BottomSheet của surveyor qua hideBottomSheet={true} */}
          <LeafletSweepMap
            parcels={maskedParcels}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            onSelectParcel={handleSelectParcel}
            onStartSurvey={handleOpenDetailModal}
            thematicMode={thematicMode}
            hideBottomSheet={true}
          />
        </section>
      </div>
    </div>
  );
};
