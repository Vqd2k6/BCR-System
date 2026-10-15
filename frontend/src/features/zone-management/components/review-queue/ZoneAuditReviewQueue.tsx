import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home,
  Building2,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Layers,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
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
}

export type TabType =
  | 'ALL'
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
  onClearExternalFilter,
  title,
}) => {
  // Determine initial scope from URL query parameter or externalFilterCategory
  const getInitialScope = (): ReviewScope => {
    const params = new URLSearchParams(window.location.search);
    const scopeParam = params.get('scope')?.toUpperCase();
    if (scopeParam === 'CONDO') return 'CONDO';
    if (scopeParam === 'URGENT') return 'URGENT';
    if (scopeParam === 'RESIDENTIAL') return 'RESIDENTIAL';

    if (externalFilterCategory === 'CRITICAL' || externalFilterCategory === 'SLA' || externalFilterCategory === 'ALERTS') {
      return 'URGENT';
    }
    if (externalFilterCategory === 'CONDO') {
      return 'CONDO';
    }
    return 'RESIDENTIAL';
  };

  const [activeScope, setActiveScope] = useState<ReviewScope>(getInitialScope);

  // Sync active scope when externalFilterCategory changes
  useEffect(() => {
    if (externalFilterCategory === 'CRITICAL' || externalFilterCategory === 'SLA' || externalFilterCategory === 'ALERTS') {
      setActiveScope('URGENT');
    } else if (externalFilterCategory === 'CONDO') {
      setActiveScope('CONDO');
    }
  }, [externalFilterCategory]);

  // Update URL search param on scope change
  const handleScopeChange = (newScope: ReviewScope) => {
    setActiveScope(newScope);
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

  const handlePreviewReport = (reportId: string | null) => {
    if (!reportId) return;
    const token = localStorage.getItem('token');
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
    const previewUrl = `${apiBase}/reports/${reportId}/preview-html?token=${encodeURIComponent(token || '')}`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
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
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit shrink-0">
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
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeScope === 'URGENT'
                ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span>Cần Xử Lý Khẩn</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                scopeCounts.urgent > 0 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
              }`}
            >
              {scopeCounts.urgent}
            </span>
          </button>
        </div>
      </div>

      {/* Render Space Components */}
      {activeScope === 'RESIDENTIAL' && (
        <ResidentialReviewQueue
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

      {activeScope === 'URGENT' && (
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
