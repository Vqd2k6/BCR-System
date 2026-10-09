import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/api';
import { METRO_22_ZONES, getZoneByCode } from '../../survey-phase1/constants/metroGisConstants';
import { ZoneAdminAppShell } from '../components/layout/ZoneAdminAppShell';
import type { ZoneNavView } from '../components/layout/ZoneAdminSidebar';
import {
  ZoneIntelligenceDashboard,
  type ZoneIntelligenceStats,
} from '../components/dashboard/ZoneIntelligenceDashboard';
import { ZoneAuditReviewQueue } from '../components/review-queue/ZoneAuditReviewQueue';
import { ZoneParcelsDataGrid } from '../components/parcels/ZoneParcelsDataGrid';
import { Phase1ExportModuleBox } from '../components/Phase1ExportModuleBox';
import { LeafletSweepMap } from '../../../components/gis/LeafletSweepMap';
import type { GisParcel } from '../../../components/gis/shared/types';
import { ShieldAlert } from 'lucide-react';
import { getNavigationFromUrl, updateNavigationUrl } from '../../../utils/navigationSync';

interface Props {
  parcels?: GisParcel[];
  onSelectParcelForSurvey?: (parcel: GisParcel) => void;
  onStartPhase1?: (parcel: GisParcel, isReadOnly?: boolean) => void;
  onStartPhase2?: (parcel: GisParcel) => void;
  onOpenBuildingHub?: (parcel: GisParcel) => void;
  onRecordAbsence?: (parcel: GisParcel) => void;
  onProposeSplit?: (parcel: GisParcel) => void;
  onReloadParcels?: () => void;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
  onNavigateToMap?: () => void;
  onNavigateToParcels?: () => void;
}

export const ZoneManagerDashboardPage: React.FC<Props> = ({
  parcels = [],
  onSelectParcelForSurvey,
  onStartPhase1,
  onStartPhase2,
  onOpenBuildingHub,
  onRecordAbsence,
  onProposeSplit,
  onReloadParcels,
  userGps,
  onNavigateToMap,
  onNavigateToParcels,
}) => {
  const { user } = useAuth();

  // Chốt chặn an ninh nội bộ: Chỉ ZONE_ADMIN và SUPER_ADMIN mới có quyền xem màn hình này
  if (user?.role !== 'ZONE_ADMIN' && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-inner">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-bold text-rose-900">Quyền Truy Cập Bị Từ Chối (403 Forbidden)</h2>
        <p className="text-xs text-rose-700 leading-relaxed max-w-md mx-auto">
          Phân hệ Điều hành Zone này dành riêng cho <strong>Quản Trị Viên Phân Khu (Zone Admin)</strong> và Lãnh đạo Ban Quản Lý ĐSĐT. 
          Tài khoản hiện tại của bạn không có đặc quyền truy cập trang này.
        </p>
      </div>
    );
  }

  const [activeNav, setActiveNav] = useState<ZoneNavView>(() => {
    const nav = getNavigationFromUrl();
    if (nav.nav) return nav.nav;
    return 'dashboard';
  });

  const resolveDefaultZone = (zoneId?: string | null): string => {
    if (!zoneId) return 'ZONE_01';
    const upper = zoneId.toUpperCase().trim();
    if (upper === 'ALL' || upper === 'ALL_ZONES') return 'ALL';
    const matched = getZoneByCode(upper);
    if (matched && matched.isDataReady) return matched.code;
    return 'ZONE_01';
  };

  const [selectedZone, setSelectedZone] = useState<string>(() => {
    const nav = getNavigationFromUrl();
    if (nav.zone) return nav.zone.toUpperCase();
    return resolveDefaultZone(user?.assignedZoneId);
  });

  // Intelligence stats state
  const [stats, setStats] = useState<ZoneIntelligenceStats>({
    totalParcels: 0,
    approved: 0,
    submitted: 0,
    inProgress: 0,
    absent: 0,
    rejected: 0,
    notSurveyed: 0,
    burlandGrade0: 0,
    burlandGrade12: 0,
    burlandGrade3: 0,
    burlandGrade45: 0,
    totalCriticalBurland: 0,
    slaOverdue48h: 0,
    slaWarning24h: 0,
    absentAttempt1: 0,
    absentAttempt2: 0,
    absentAttempt3Plus: 0,
    velocityPerDay: 1.5,
    estimatedCompletionDays: 30,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Click-to-filter state from Dashboard to Review Queue
  const [activeFilterCategory, setActiveFilterCategory] = useState<string | undefined>(undefined);
  const [activeFilterValue, setActiveFilterValue] = useState<string | undefined>(undefined);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | undefined>(undefined);

  const fetchLiveIntelligence = useCallback(async (zone: string) => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/analytics/progress', {
        params: { zoneId: zone },
      });
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setStats({
          totalParcels: Number(d.total_parcels || 0),
          approved: Number(d.approved_count || 0),
          submitted: Number(d.submitted_count || 0),
          inProgress: Number(d.in_progress_count || 0),
          absent: Number(d.absent_count || 0),
          rejected: Number(d.rejected_count || 0),
          notSurveyed: Number(d.not_surveyed_count || 0),
          burlandGrade0: Number(d.burland_grade_0_count || 0),
          burlandGrade12: Number(d.burland_grade_1_2_count || 0),
          burlandGrade3: Number(d.burland_grade_3_count || 0),
          burlandGrade45: Number(d.burland_grade_4_5_count || 0),
          totalCriticalBurland: Number(d.total_critical_burland || 0),
          slaOverdue48h: Number(d.sla_overdue_48h_count || 0),
          slaWarning24h: Number(d.sla_warning_24h_count || 0),
          absentAttempt1: Number(d.absent_attempt_1_count || 0),
          absentAttempt2: Number(d.absent_attempt_2_count || 0),
          absentAttempt3Plus: Number(d.absent_attempt_3_plus_count || 0),
          velocityPerDay: Number(d.velocity_per_day || 1.5),
          estimatedCompletionDays: Number(d.estimated_completion_days || 30),
        });
      }
    } catch (e) {
      console.warn('[ZoneManager] Failed to fetch live analytics:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveIntelligence(selectedZone);
  }, [selectedZone, fetchLiveIntelligence]);

  // Handle click-to-filter from Dashboard
  const handleDashboardFilterClick = (cat: string, val: string, label: string) => {
    setActiveFilterCategory(cat);
    setActiveFilterValue(val);
    setActiveFilterLabel(label);
    // Tự động chuyển sang xem Hàng Đợi Thẩm Định
    handleNavChange('review');
  };

  const handleClearFilter = () => {
    setActiveFilterCategory(undefined);
    setActiveFilterValue(undefined);
    setActiveFilterLabel(undefined);
  };

  const handleNavChange = (nav: ZoneNavView) => {
    setActiveNav(nav);
    updateNavigationUrl({ nav });
  };

  // Đồng bộ popstate nếu người dùng dùng phím Back / Forward trong Zone Portal
  useEffect(() => {
    const handlePopState = () => {
      const nav = getNavigationFromUrl();
      if (nav.nav && nav.nav !== activeNav) {
        setActiveNav(nav.nav);
      }
      if (nav.zone && nav.zone !== selectedZone) {
        setSelectedZone(nav.zone);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeNav, selectedZone]);

  return (
    <ZoneAdminAppShell
      activeNav={activeNav}
      onChangeNav={handleNavChange}
      selectedZone={selectedZone}
      onSelectZone={(z) => {
        setSelectedZone(z);
        updateNavigationUrl({ zone: z });
        handleClearFilter();
      }}
      pendingCount={stats.submitted}
      criticalAlertCount={stats.totalCriticalBurland + stats.slaOverdue48h}
      isLoading={isLoading}
      onRefresh={() => fetchLiveIntelligence(selectedZone)}
    >
      {/* View 1: Dashboard Chỉ Huy & Toàn Cảnh Tiến Độ */}
      {activeNav === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <ZoneIntelligenceDashboard
            stats={stats}
            selectedZone={selectedZone}
            onFilterClick={handleDashboardFilterClick}
            activeFilterLabel={activeFilterLabel}
            onClearFilter={handleClearFilter}
          />

          {/* Quick Review Queue Summary underneath */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Hồ Sơ Cần Kiểm Soát Khẩn Cấp (Burland ≥ 3 / Cờ Lỗi)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {stats.totalCriticalBurland} ca cần xử lý
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleClearFilter();
                  setActiveNav('review');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1 hover:underline"
              >
                <span>Xem toàn bộ hàng đợi ({stats.submitted})</span>
                <span>➔</span>
              </button>
            </div>

            <ZoneAuditReviewQueue
              selectedZone={selectedZone}
              onStatsNeedRefresh={() => fetchLiveIntelligence(selectedZone)}
              externalFilterCategory={activeFilterCategory || 'CRITICAL'}
              externalFilterValue={activeFilterValue}
              onClearExternalFilter={handleClearFilter}
              defaultTab="CRITICAL"
              title="Hồ Sơ Ưu Tiên Kiểm Soát Khẩn Cấp (Burland ≥ 3 / Cờ Lỗi)"
            />
          </div>
        </div>
      )}

      {/* View 2: Hàng Đợi Thẩm Định Độc Lập */}
      {activeNav === 'review' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {activeFilterLabel && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">
              <span>Đang lọc theo chỉ số: <strong className="text-indigo-700">{activeFilterLabel}</strong></span>
              <button
                type="button"
                onClick={handleClearFilter}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold cursor-pointer transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}

          <ZoneAuditReviewQueue
            selectedZone={selectedZone}
            onStatsNeedRefresh={() => fetchLiveIntelligence(selectedZone)}
            externalFilterCategory={activeFilterCategory}
            externalFilterValue={activeFilterValue}
            onClearExternalFilter={handleClearFilter}
          />
        </div>
      )}

      {/* View 3: Bản Đồ Số Không Gian GIS Tuyến (Nhúng hoàn toàn trong AppShell) */}
      {activeNav === 'map' && (
        <div className="w-full h-[calc(100vh-64px)] relative">
          <LeafletSweepMap
            parcels={parcels}
            selectedZone={selectedZone}
            onSelectZone={(z) => setSelectedZone(z)}
            onSelectParcel={(p) => {
              onSelectParcelForSurvey?.(p);
            }}
            onStartSurvey={onStartPhase1 || (() => {})}
            onStartPhase2={onStartPhase2 || (() => {})}
            onOpenBuildingHub={onOpenBuildingHub || (() => {})}
            onRecordAbsence={onRecordAbsence || (() => {})}
            onProposeSplit={onProposeSplit || (() => {})}
            onSwapSuccess={onReloadParcels}
            userGps={userGps}
          />
        </div>
      )}

      {/* View 4: Sổ Quản Trị Địa Chính Phân Khu (Desktop Data Grid) */}
      {activeNav === 'parcels' && (
        <div className="animate-in fade-in duration-200">
          <ZoneParcelsDataGrid
            selectedZone={selectedZone}
            initialParcels={parcels}
            onNavigateToMap={(parcel) => {
              onSelectParcelForSurvey?.(parcel);
              setActiveNav('map');
            }}
            onViewSurvey={(parcel) => {
              setActiveFilterCategory('SEARCH');
              setActiveFilterValue(parcel.projectParcelCode || parcel.officialCadastralCode);
              setActiveFilterLabel(`Thửa đất ${parcel.projectParcelCode || parcel.id}`);
              setActiveNav('review');
            }}
            onRefreshStats={() => fetchLiveIntelligence(selectedZone)}
          />
        </div>
      )}

      {/* View 5: Phân Hệ Xuất Báo Cáo Phase 1 (Mẫu 0410 Song Ngữ) */}
      {activeNav === 'export' && (
        <div className="animate-in fade-in duration-200">
          <Phase1ExportModuleBox initialZoneId={selectedZone} hideZoneSelect={true} />
        </div>
      )}
    </ZoneAdminAppShell>
  );
};
