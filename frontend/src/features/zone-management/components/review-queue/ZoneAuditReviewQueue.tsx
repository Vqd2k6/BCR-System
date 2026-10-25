import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Building2,
  ShieldAlert,
  Lock,
  X,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AuditStudioModal } from './AuditStudioModal';
import { RejectReportModal } from './RejectReportModal';
import { AdminReassignParcelModal } from './AdminReassignParcelModal';
import { UnifiedGisMutationModal } from '../../../../components/gis/cadastral-editor/UnifiedGisMutationModal';
import { CadastralBoundaryReshapeModal } from '../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import { RevertToDraftModal } from './RevertToDraftModal';
import { useAuth } from '../../../../context/AuthContext';
import { AuditHistoryModal } from './AuditHistoryModal';
import type { AuditHistoryLogItem } from './AuditHistoryModal';
import type { GisParcel } from '../../../../components/gis/shared/types';

import { ResidentialReviewQueue } from './residential/ResidentialReviewQueue';
import { CondoProjectsReviewQueue } from './condo/CondoProjectsReviewQueue';
import { UrgentReviewQueue } from './urgent/UrgentReviewQueue';

const isProductionScopeLockActive = (): boolean => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prodPreview') === '1') return true;
    const host = window.location.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.endsWith('.trycloudflare.com')
    ) {
      return false;
    }
  }
  return import.meta.env.PROD && !import.meta.env.DEV;
};

export interface PendingSubmissionItem {
  report_id: string | null;
  report_type?: string | null;
  parcel_id: string;
  unit_id?: string | null;
  unit_code?: string | null;
  display_code?: string | null;
  unit_type?: string | null;
  unit_floor_number?: number | null;
  unit_owner_name?: string | null;
  unit_owner_phone?: string | null;
  unit_status?: string | null;
  unit_resident_status?: string | null;
  parent_parcel_code?: string | null;
  parent_parcel_is_locked?: boolean | null;
  project_parcel_code: string;
  house_number: string;
  street: string;
  zone_id: string;
  building_type: string;
  status: string;
  parcel_status: string;
  is_refused_or_absent: boolean;
  absence_attempt_count: number;
  survey_date: string | null;
  created_at: string;
  updated_at: string;
  surveyor_id: string | null;
  surveyor_name: string | null;
  surveyor_code: string | null;
  surveyor_phone: string | null;
  burland_damage_category: string | null;
  burland_score?: number | null;
  burland_max_crack_width_mm: number | null;
  ecs_score: number | null;
  vi_score: number | null;
  defect_count: number;
  alert_count: number;
  owner_name?: string | null;
  land_area_m2?: number | null;
  approved_at?: string | null;
  judgement_notes?: string | null;
  rejection_reason?: string | null;
  approver_name?: string | null;
  approver_role?: string | null;
  parent_parcel_seal_hash?: string | null;
  parent_parcel_locked_at?: string | null;
  parent_parcel_locked_by_name?: string | null;
  current_version_number?: number;
  version_count?: number;
  has_admin_diff?: boolean;
  latest_version_tag?: string | null;
  latest_edit_reason?: string | null;
  export_revision?: number;
  has_pending_release?: boolean;
}

export type TabType =
  | 'ALL'
  | 'UNDER_REVIEW'
  | 'RESIDENTIAL'
  | 'CONDO_MASTER'
  | 'MASTER_AREA'
  | 'CONDO_UNIT'
  | 'ABSENT'
  | 'CRITICAL'
  | 'REJECTED'
  | 'APPROVED';

export type ReviewScope = 'RESIDENTIAL' | 'CONDO' | 'URGENT';

interface Props {
  selectedZone: string;
  onStatsNeedRefresh?: () => void;
  externalFilterCategory?: string;
  externalFilterValue?: string;
  onClearExternalFilter?: () => void;
  defaultTab?: TabType;
  title?: string;
}

export const ZoneAuditReviewQueue: React.FC<Props> = ({
  selectedZone,
  onStatsNeedRefresh,
  externalFilterCategory,
  externalFilterValue,
  title,
}) => {
  const isProdScopeLocked = isProductionScopeLockActive();
  const [lockedScopeNotice, setLockedScopeNotice] = useState<'CONDO' | 'URGENT' | null>(null);

  // Determine initial scope from URL query parameter or externalFilterCategory
  const getInitialScope = (): ReviewScope => {
    const params = new URLSearchParams(window.location.search);
    const scopeParam = params.get('scope')?.toUpperCase();
    if (scopeParam === 'CONDO') return 'CONDO';
    if (scopeParam === 'URGENT' && !isProdScopeLocked) return 'URGENT';
    if (scopeParam === 'RESIDENTIAL') return 'RESIDENTIAL';

    if ((externalFilterCategory === 'CRITICAL' || externalFilterCategory === 'SLA' || externalFilterCategory === 'ALERTS') && !isProdScopeLocked) {
      return 'URGENT';
    }
    if (externalFilterCategory === 'CONDO' || externalFilterCategory === 'CONDO_SEARCH') {
      return 'CONDO';
    }
    try {
      const savedScope = sessionStorage.getItem('ksqh_review_active_scope');
      if (savedScope === 'CONDO' || savedScope === 'RESIDENTIAL' || (savedScope === 'URGENT' && !isProdScopeLocked)) {
        return savedScope;
      }
    } catch {
      // ignore
    }
    return 'RESIDENTIAL';
  };

  const [activeScope, setActiveScope] = useState<ReviewScope>(getInitialScope);

  // Sync active scope when externalFilterCategory changes
  useEffect(() => {
    if (externalFilterCategory === 'CONDO' || externalFilterCategory === 'CONDO_SEARCH') {
      setActiveScope('CONDO');
    } else if (externalFilterCategory === 'SEARCH') {
      setActiveScope('RESIDENTIAL');
    } else if (externalFilterCategory === 'CRITICAL' || externalFilterCategory === 'SLA' || externalFilterCategory === 'ALERTS') {
      if (isProdScopeLocked) {
        setActiveScope('RESIDENTIAL');
      } else {
        setActiveScope('URGENT');
      }
    }
  }, [externalFilterCategory, isProdScopeLocked]);

  useEffect(() => {
    if (!lockedScopeNotice) return;
    const timer = window.setTimeout(() => {
      setLockedScopeNotice(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [lockedScopeNotice]);

  // Update URL search param on scope change
  const handleScopeChange = (newScope: ReviewScope) => {
    if (isProdScopeLocked && newScope === 'URGENT') {
      setLockedScopeNotice(newScope);
      return;
    }
    setLockedScopeNotice(null);
    setActiveScope(newScope);
    try {
      sessionStorage.setItem('ksqh_review_active_scope', newScope);
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    url.searchParams.set('nav', 'review');
    url.searchParams.set('scope', newScope.toLowerCase());
    window.history.replaceState({}, '', url.toString());
  };

  // Scope counts
  const [scopeCounts, setScopeCounts] = useState({
    residential: 0,
    condoTowers: 0,
    urgent: 0,
  });

  const fetchScopeCounts = useCallback(async () => {
    if (!selectedZone) return;
    try {
      const res = await api.get('/admin/reports/scope-counts', {
        params: {
          zoneId: selectedZone,
        },
      });

      if (res.data?.success && res.data.data) {
        setScopeCounts({
          residential: Number(res.data.data.residential || 0),
          condoTowers: Number(res.data.data.condoTowers || 0),
          urgent: Number(res.data.data.urgent || 0),
        });
      }
    } catch (err: unknown) {
      console.warn('[ZoneAuditReviewQueue] Không thể tải tổng số lượng scope:', err);
    }
  }, [selectedZone]);

  useEffect(() => {
    fetchScopeCounts();
  }, [selectedZone, fetchScopeCounts]);

  const { user } = useAuth();
  const isZoneOrSuperAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Modal Management
  const [selectedAuditReportId, setSelectedAuditReportId] = useState<string | null>(null);
  const [auditStudioOpen, setAuditStudioOpen] = useState(false);
  const [revertModalData, setRevertModalData] = useState<{
    reportId: string;
    parcelCode: string;
  } | null>(null);

  const [rejectModalData, setRejectModalData] = useState<{
    reportId: string;
    parcelCode: string;
    surveyorName?: string;
  } | null>(null);

  const [reassignModalData, setReassignModalData] = useState<{
    reportId: string;
    parcelCode: string;
    parcelId: string;
    houseNumber?: string;
    street?: string;
    surveyorName?: string;
    zoneId?: string;
  } | null>(null);

  const [mutationModalData, setMutationModalData] = useState<{
    parcelId: string;
    parcelCode: string;
    houseNumber?: string;
    street?: string;
    currentAreaM2?: number;
    zoneId?: string;
    reportId?: string;
  } | null>(null);

  const [reshapeModalParcel, setReshapeModalParcel] = useState<GisParcel | null>(null);

  // Quick Audit History Modal
  const [auditHistoryModalOpen, setAuditHistoryModalOpen] = useState(false);
  const [auditHistoryLogs, setAuditHistoryLogs] = useState<AuditHistoryLogItem[]>([]);
  const [auditHistoryReportCode, setAuditHistoryReportCode] = useState<string>('');

  const handleOpenStudio = (reportId: string | null) => {
    setSelectedAuditReportId(reportId);
    setAuditStudioOpen(true);
  };

  const handlePreviewReport = async (reportId: string | null) => {
    if (!reportId) return;
    try {
      const res = await api.get(`/reports/${encodeURIComponent(reportId)}/preview/html`, {
        responseType: 'text',
      });
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      console.error('[ZoneAuditReviewQueue] Lỗi mở xem trước báo cáo:', err);
      alert('Không thể mở bản xem trước báo cáo.');
    }
  };

  const handleOpenAuditHistory = async (reportId: string, itemCode?: string) => {
    try {
      if (itemCode) {
        setAuditHistoryReportCode(itemCode);
      }
      const res = await api.get(`/admin/reports/${reportId}/audit-view`);
      if (res.data?.success && res.data.data) {
        setAuditHistoryLogs(res.data.data.auditHistory || []);
        setAuditHistoryReportCode(res.data.data.projectParcelCode || itemCode || reportId);
        setAuditHistoryModalOpen(true);
      }
    } catch (err: unknown) {
      console.error('[ZoneAuditReviewQueue] Lỗi tải nhật ký kiểm toán:', err);
      alert('Không thể tải nhật ký kiểm toán của hồ sơ.');
    }
  };

  const handleOpenReshape = async (item: PendingSubmissionItem) => {
    try {
      const res = await api.get(`/parcels/${item.parcel_id}`);
      if (res.data?.success && res.data.data) {
        const raw = res.data.data;
        let coords: [number, number][] = [];
        if (raw.cadastral_geojson?.coordinates?.[0]) {
          coords = raw.cadastral_geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
        } else if (raw.coordinates && Array.isArray(raw.coordinates)) {
          coords = raw.coordinates;
        }

        setReshapeModalParcel({
          id: raw.id,
          projectParcelCode: raw.project_parcel_code || item.project_parcel_code,
          officialCadastralCode: raw.official_cadastral_code || '',
          houseNumber: raw.house_number || item.house_number || '',
          street: raw.street || item.street || '',
          ownerName: raw.owner_name || item.owner_name || '',
          surveyStatus: raw.survey_status || item.status,
          coordinates: coords,
          landArea: Number(raw.land_area_m2 || item.land_area_m2 || 0),
          constructionArea: Number(raw.construction_area_m2 || raw.land_area_m2 || 0),
          floorCount: Number(raw.floor_count || 1),
          buildingType: raw.building_type || 'STANDALONE',
          zoneId: raw.zone_id || selectedZone,
        });
      }
    } catch (err: unknown) {
      console.error('[ZoneAuditReviewQueue] Lỗi tải chi tiết thửa đất để nắn ranh:', err);
      alert('Không thể tải dữ liệu thửa đất.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Segmented Scope Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>{title || 'Hàng Đợi Thẩm Định Kỹ Thuật & Pháp Lý'}</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Metro 2 BCS
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Phân định 3 không gian thẩm định chuyên biệt: Nhà Dân Độc Lập, Khối Tháp Chung Cư và Ca Khẩn Cấp.
          </p>
        </div>

        {/* Segmented Scope Switcher */}
        <div className="flex items-center flex-wrap gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit shrink-0">
          {/* Space 1: Residential */}
          <button
            type="button"
            onClick={() => handleScopeChange('RESIDENTIAL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeScope === 'RESIDENTIAL'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Nhà Dân Độc Lập</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeScope === 'RESIDENTIAL'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {scopeCounts.residential}
            </span>
          </button>

          {/* Space 2: Condo */}
          <button
            type="button"
            onClick={() => handleScopeChange('CONDO')}
            title="Không gian thẩm định Dự Án Chung Cư"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeScope === 'CONDO'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Dự Án Chung Cư</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeScope === 'CONDO'
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {scopeCounts.condoTowers} Tòa
            </span>
          </button>

          {/* Space 3: Urgent */}
          <button
            type="button"
            onClick={() => handleScopeChange('URGENT')}
            aria-disabled={isProdScopeLocked}
            title={
              isProdScopeLocked
                ? 'Đang phát triển — Tạm khóa trên môi trường Production'
                : 'Không gian thẩm định Cần Xử Lý Khẩn'
            }
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isProdScopeLocked
                ? 'text-slate-400 dark:text-slate-500 opacity-80 hover:opacity-100'
                : activeScope === 'URGENT'
                  ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isProdScopeLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>Cần Xử Lý Khẩn</span>
            {isProdScopeLocked ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                Đang phát triển
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  scopeCounts.urgent > 0 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                }`}
              >
                {scopeCounts.urgent}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Thông báo khi bấm vào phân mục đang khóa trên môi trường Production */}
      {isProdScopeLocked && lockedScopeNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/80 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <span className="font-black">
                Phân mục &ldquo;{lockedScopeNotice === 'CONDO' ? 'Dự Án Chung Cư' : 'Cần Xử Lý Khẩn'}&rdquo; đang phát triển:
              </span>{' '}
              <span className="font-medium text-amber-800 dark:text-amber-300">
                Tính năng này hiện đang được khóa trên máy chủ Production để hoàn thiện logic nghiệp vụ. Hiện tại chỉ mở khóa thẩm định cho mục <strong>Nhà Dân Độc Lập</strong>.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLockedScopeNotice(null)}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer shrink-0"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Render Space Components */}
      {activeScope === 'RESIDENTIAL' && (
        <ResidentialReviewQueue
          selectedZone={selectedZone}
          externalSearchQuery={
            externalFilterCategory === 'SEARCH' || externalFilterCategory === 'CONDO_SEARCH'
              ? externalFilterValue
              : undefined
          }
          onOpenStudio={handleOpenStudio}
          onPreviewReport={handlePreviewReport}
          onOpenRejectModal={(item) =>
            setRejectModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              surveyorName: item.surveyor_name || undefined,
            })
          }
          onOpenReassignModal={(item) =>
            setReassignModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              parcelId: item.parcel_id,
              houseNumber: item.house_number,
              street: item.street,
              surveyorName: item.surveyor_name || undefined,
              zoneId: item.zone_id,
            })
          }
          onOpenMutationModal={(item) =>
            setMutationModalData({
              parcelId: item.parcel_id,
              parcelCode: item.project_parcel_code,
              houseNumber: item.house_number,
              street: item.street,
              currentAreaM2: item.land_area_m2 || 0,
              zoneId: item.zone_id,
              reportId: item.report_id || undefined,
            })
          }
          onOpenReshapeModal={handleOpenReshape}
          onOpenAuditHistory={handleOpenAuditHistory}
          onOpenRevertModal={isZoneOrSuperAdmin ? (item) => setRevertModalData({ reportId: item.report_id || '', parcelCode: item.project_parcel_code }) : undefined}
          onStatsNeedRefresh={() => {
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {activeScope === 'CONDO' && (
        <CondoProjectsReviewQueue
          selectedZone={selectedZone}
          externalSearchQuery={
            externalFilterCategory === 'CONDO_SEARCH' || externalFilterCategory === 'SEARCH'
              ? externalFilterValue
              : undefined
          }
          onOpenStudio={handleOpenStudio}
          onPreviewReport={handlePreviewReport}
          onOpenRejectModal={(item) =>
            setRejectModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              surveyorName: item.surveyor_name || undefined,
            })
          }
          onOpenReassignModal={(item) =>
            setReassignModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              parcelId: item.parcel_id,
              houseNumber: item.house_number,
              street: item.street,
              surveyorName: item.surveyor_name || undefined,
              zoneId: item.zone_id,
            })
          }
          onOpenMutationModal={(item) =>
            setMutationModalData({
              parcelId: item.parcel_id,
              parcelCode: item.project_parcel_code,
              houseNumber: item.house_number,
              street: item.street,
              currentAreaM2: item.land_area_m2 || 0,
              zoneId: item.zone_id,
              reportId: item.report_id || undefined,
            })
          }
          onOpenReshapeModal={handleOpenReshape}
          onOpenAuditHistory={handleOpenAuditHistory}
          onStatsNeedRefresh={() => {
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {!isProdScopeLocked && activeScope === 'URGENT' && (
        <UrgentReviewQueue
          selectedZone={selectedZone}
          onOpenStudio={handleOpenStudio}
          onPreviewReport={handlePreviewReport}
          onOpenRejectModal={(item) =>
            setRejectModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              surveyorName: item.surveyor_name || undefined,
            })
          }
          onOpenReassignModal={(item) =>
            setReassignModalData({
              reportId: item.report_id || '',
              parcelCode: item.project_parcel_code,
              parcelId: item.parcel_id,
              houseNumber: item.house_number,
              street: item.street,
              surveyorName: item.surveyor_name || undefined,
              zoneId: item.zone_id,
            })
          }
          onOpenMutationModal={(item) =>
            setMutationModalData({
              parcelId: item.parcel_id,
              parcelCode: item.project_parcel_code,
              houseNumber: item.house_number,
              street: item.street,
              currentAreaM2: item.land_area_m2 || 0,
              zoneId: item.zone_id,
              reportId: item.report_id || undefined,
            })
          }
          onOpenReshapeModal={handleOpenReshape}
          onOpenAuditHistory={handleOpenAuditHistory}
          onStatsNeedRefresh={() => {
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
          initialSubTab={externalFilterCategory === 'SLA' ? 'SLA' : externalFilterCategory === 'CRITICAL' ? 'BURLAND' : 'ALL'}
        />
      )}

      {/* Audit Studio Modal */}
      {auditStudioOpen && selectedAuditReportId && (
        <AuditStudioModal
          isOpen={auditStudioOpen}
          reportId={selectedAuditReportId}
          onClose={() => {
            setAuditStudioOpen(false);
            setSelectedAuditReportId(null);
          }}
          onRefreshList={() => {
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Reject Modal */}
      {rejectModalData && (
        <RejectReportModal
          isOpen={Boolean(rejectModalData)}
          reportId={rejectModalData.reportId}
          parcelCode={rejectModalData.parcelCode}
          surveyorName={rejectModalData.surveyorName}
          onClose={() => setRejectModalData(null)}
          onSuccess={() => {
            setRejectModalData(null);
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Revert To Draft Modal */}
      {revertModalData && (
        <RevertToDraftModal
          isOpen={Boolean(revertModalData)}
          reportId={revertModalData.reportId}
          parcelCode={revertModalData.parcelCode}
          onClose={() => setRevertModalData(null)}
          onSuccess={() => {
            setRevertModalData(null);
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Reassign Parcel Modal */}
      {reassignModalData && (
        <AdminReassignParcelModal
          isOpen={Boolean(reassignModalData)}
          reportId={reassignModalData.reportId}
          currentParcelId={reassignModalData.parcelId}
          currentParcelCode={reassignModalData.parcelCode}
          currentHouseNumber={reassignModalData.houseNumber}
          currentStreet={reassignModalData.street}
          surveyorName={reassignModalData.surveyorName || 'KSV'}
          zoneId={reassignModalData.zoneId || selectedZone}
          onClose={() => setReassignModalData(null)}
          onSuccess={() => {
            setReassignModalData(null);
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Mutation Modal */}
      {mutationModalData && (
        <UnifiedGisMutationModal
          isOpen={Boolean(mutationModalData)}
          onClose={() => setMutationModalData(null)}
          parcelId={mutationModalData.parcelId}
          parcelCode={mutationModalData.parcelCode}
          houseNumber={mutationModalData.houseNumber}
          street={mutationModalData.street}
          currentAreaM2={mutationModalData.currentAreaM2 || 0}
          initialZoneId={mutationModalData.zoneId || selectedZone}
          reportId={mutationModalData.reportId}
          onSuccess={() => {
            setMutationModalData(null);
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Cadastral Boundary Reshape Modal */}
      {reshapeModalParcel && (
        <CadastralBoundaryReshapeModal
          isOpen={Boolean(reshapeModalParcel)}
          parcel={reshapeModalParcel}
          onClose={() => setReshapeModalParcel(null)}
          onSuccess={() => {
            setReshapeModalParcel(null);
            fetchScopeCounts();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Audit History Modal */}
      {auditHistoryModalOpen && (
        <AuditHistoryModal
          isOpen={auditHistoryModalOpen}
          onClose={() => {
            setAuditHistoryModalOpen(false);
            setAuditHistoryLogs([]);
          }}
          reportCode={auditHistoryReportCode}
          logs={auditHistoryLogs}
        />
      )}
    </div>
  );
};
