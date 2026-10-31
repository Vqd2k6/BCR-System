import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Building2,
  Layers,
  DoorOpen,
  UserX,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  AlertTriangle,
  Clock,
  XCircle,
  Filter,
  KeyRound,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import { ReviewQueueTableRow } from '../ReviewQueueTableRow';
import { CondoMasterSummaryBanner } from './queue/CondoMasterSummaryBanner';
import { CondoFloorMatrixDrawer } from './queue/CondoFloorMatrixDrawer';
import { CondoFinalSealModal, type CondoBlockingItem } from './seal/CondoFinalSealModal';
import type { CondoFloorMatrixRow, CondoParentMasterSummary } from './types/condo-audit.types';

interface Props {
  towerParcelId: string;
  towerItem: PendingSubmissionItem;
  onBackToTowers: () => void;
  onOpenStudio: (reportId: string | null) => void;
  onPreviewReport: (reportId: string | null) => void;
  onOpenRejectModal: (item: PendingSubmissionItem) => void;
  onOpenReassignModal: (item: PendingSubmissionItem) => void;
  onOpenMutationModal: (item: PendingSubmissionItem) => void;
  onOpenReshapeModal?: (item: PendingSubmissionItem) => void;
  onOpenAuditHistory: (reportId: string, itemCode?: string) => void;
  onStatsNeedRefresh?: () => void;
}

type TowerUnitTab =
  | 'ALL'
  | 'MASTER_AREA'
  | 'CONDO_UNIT'
  | 'PENDING'
  | 'CRITICAL'
  | 'ABSENT'
  | 'GRADE_0'
  | 'REJECTED'
  | 'APPROVED';

export const CondoTowerUnitQueue: React.FC<Props> = ({
  towerParcelId,
  towerItem,
  onBackToTowers,
  onOpenStudio,
  onPreviewReport,
  onOpenAuditHistory,
  onStatsNeedRefresh,
}) => {
  const queueSessionKey = `ksqh_condo_tower_unit_queue_${towerParcelId}`;
  const [activeTab, setActiveTab] = useState<TowerUnitTab>(() => {
    try {
      const saved = sessionStorage.getItem(queueSessionKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { activeTab?: TowerUnitTab };
        if (parsed.activeTab) return parsed.activeTab;
      }
    } catch {
      // ignore
    }
    return 'ALL';
  });
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(queueSessionKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { searchInput?: string };
        if (typeof parsed.searchInput === 'string') return parsed.searchInput;
      }
    } catch {
      // ignore
    }
    return '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        queueSessionKey,
        JSON.stringify({ activeTab, searchInput })
      );
    } catch {
      // ignore
    }
  }, [queueSessionKey, activeTab, searchInput]);

  const [items, setItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [showBatchApprovePinModal, setShowBatchApprovePinModal] = useState(false);
  const [generatedBatchPin, setGeneratedBatchPin] = useState('');
  const [enteredBatchPin, setEnteredBatchPin] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const generateNewBatchPin = useCallback(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedBatchPin(code);
    setEnteredBatchPin('');
  }, []);

  const openBatchApprovePinModal = useCallback(() => {
    if (selectedReportIds.length === 0) return;
    generateNewBatchPin();
    setShowBatchApprovePinModal(true);
  }, [selectedReportIds.length, generateNewBatchPin]);
  const pageSize = 50;

  // Tower Progress & Floor Matrix State
  const [progressMeta, setProgressMeta] = useState<{
    masterReportId: string | null;
    masterReportStatus: string;
    parentMasterSummary: CondoParentMasterSummary | null;
    floorPlanCount: number;
    totalItems: number;
    completedItems: number;
    isReadyForFinalSeal: boolean;
    isLocked: boolean;
    sealHash: string | null;
    blockingItems: CondoBlockingItem[];
    floorMatrix: CondoFloorMatrixRow[];
  }>({
    masterReportId: towerItem.report_id || null,
    masterReportStatus: towerItem.status || 'MISSING',
    parentMasterSummary: null,
    floorPlanCount: 0,
    totalItems: 0,
    completedItems: 0,
    isReadyForFinalSeal: false,
    isLocked: Boolean(towerItem.parent_parcel_is_locked),
    sealHash: towerItem.parent_parcel_seal_hash || null,
    blockingItems: [],
    floorMatrix: [],
  });
  const [showFloorMatrixDrawer, setShowFloorMatrixDrawer] = useState(false);
  const [showFinalSealModal, setShowFinalSealModal] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [towerParcelId, activeTab, selectedFloor]);

  const fetchTowerUnitsAndProgress = useCallback(async () => {
    if (!towerParcelId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [unitsRes, progRes] = await Promise.all([
        api.get('/admin/reports/pending-reviews', {
          params: {
            parcelId: towerParcelId,
            status: 'ALL',
            limit: 500,
          },
        }),
        api.get(`/admin/condo/${towerParcelId}/progress-summary`),
      ]);

      if (unitsRes.data?.success && Array.isArray(unitsRes.data.data)) {
        setItems(unitsRes.data.data);
      } else if (unitsRes.data?.success && Array.isArray(unitsRes.data.data?.items)) {
        setItems(unitsRes.data.data.items);
      } else {
        setItems([]);
      }

      if (progRes.data?.success && progRes.data.data) {
        const raw = progRes.data.data;
        setProgressMeta({
          masterReportId: raw.masterReport?.id || towerItem.report_id || null,
          masterReportStatus: raw.masterReport?.status || towerItem.status || 'MISSING',
          parentMasterSummary: raw.parentMasterSummary || null,
          floorPlanCount: Array.isArray(raw.floorPlans) ? raw.floorPlans.length : 0,
          totalItems: Number(raw.stats?.totalItems ?? 0),
          completedItems: Number(raw.stats?.completedItems ?? 0),
          isReadyForFinalSeal: Boolean(raw.isReadyForFinalSeal),
          isLocked: Boolean(raw.parcel?.isLocked ?? towerItem.parent_parcel_is_locked),
          sealHash: raw.parcel?.sealHash || towerItem.parent_parcel_seal_hash || null,
          blockingItems: Array.isArray(raw.blockingItems) ? raw.blockingItems : [],
          floorMatrix: Array.isArray(raw.floorMatrix) ? raw.floorMatrix : [],
        });
      }
    } catch (err: unknown) {
      console.error('[CondoTowerUnitQueue] Lỗi tải danh sách căn của tòa:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    towerParcelId,
    towerItem.report_id,
    towerItem.status,
    towerItem.parent_parcel_is_locked,
    towerItem.parent_parcel_seal_hash,
  ]);

  useEffect(() => {
    fetchTowerUnitsAndProgress();
  }, [fetchTowerUnitsAndProgress]);

  const isMasterRow = useCallback(
    (item: PendingSubmissionItem) =>
      item.report_type === 'CONDO_PARENT_MASTER' ||
      item.report_type === 'BUILDING_MASTER' ||
      item.report_type === 'CONDO_MASTER' ||
      (item.building_type?.includes('CONDO') &&
        !item.unit_id &&
        item.parcel_id === towerParcelId &&
        !item.unit_code),
    [towerParcelId]
  );

  const isMasterAreaRow = (item: PendingSubmissionItem) =>
    item.unit_type === 'MASTER' ||
    item.unit_type === 'MASTER_AREA' ||
    Boolean(item.unit_code && (item.unit_code.startsWith('M-') || item.unit_code.startsWith('MA-') || item.unit_code.startsWith('AREA-'))) ||
    item.report_type === 'MASTER_AREA';

  const isChildUnitRow = (item: PendingSubmissionItem) =>
    !isMasterAreaRow(item) &&
    (item.unit_type === 'UNIT' ||
      item.unit_type === 'APARTMENT' ||
      Boolean(item.unit_code && item.unit_code.startsWith('U-')) ||
      item.report_type === 'CONDO_UNIT' ||
      item.report_type === 'UNIT_CHILD' ||
      Boolean(item.unit_id));

  const isCriticalRow = (item: PendingSubmissionItem) =>
    (item.burland_score ?? 0) >= 3 ||
    ['CAT_3_MODERATE', 'CAT_4_SEVERE', 'CAT_5_VERY_SEVERE'].includes(
      String(item.burland_damage_category || '')
    ) ||
    (item.burland_max_crack_width_mm ?? 0) >= 3.0;

  const isAbsentRow = (item: PendingSubmissionItem) =>
    Boolean(
      item.is_refused_or_absent ||
        item.absence_state === 'ABSENT' ||
        item.absence_state === 'SUSPECTED' ||
        item.status === 'POSTPONED_ABSENT' ||
        item.unit_status === 'POSTPONED_ABSENT' ||
        item.unit_status === 'POSTPONED_ABSENT_VERIFIED'
    );

  const isGrade0EligibleRow = (item: PendingSubmissionItem) =>
    item.status === 'SUBMITTED' &&
    !item.has_admin_diff &&
    (item.version_count ?? 0) <= 1 &&
    Number(item.defect_count) === 0 &&
    (item.burland_damage_category === 'GRADE_0' ||
      item.burland_damage_category === 'CAT_0_NEGLIGIBLE' ||
      !item.burland_damage_category);

  // Available floors for filter dropdown
  const availableFloors = useMemo(() => {
    const flSet = new Set<number>();
    items.forEach((i) => {
      if (!isMasterRow(i) && i.unit_floor_number !== null && i.unit_floor_number !== undefined) {
        flSet.add(Number(i.unit_floor_number));
      }
    });
    progressMeta.floorMatrix.forEach((fm) => flSet.add(fm.floorNumber));
    return Array.from(flSet).sort((a, b) => a - b);
  }, [items, isMasterRow, progressMeta.floorMatrix]);

  // Tab Filtering, Floor Filtering & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (isMasterRow(item)) return false;

      if (selectedFloor !== null && Number(item.unit_floor_number) !== selectedFloor) {
        return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchUnitCode = (item.unit_code || '').toLowerCase().includes(q);
        const matchDisplayCode = (item.display_code || '').toLowerCase().includes(q);
        const matchOwner = (item.unit_owner_name || item.owner_name || '').toLowerCase().includes(q);
        const matchSurveyor = (item.surveyor_name || '').toLowerCase().includes(q);
        if (!matchUnitCode && !matchDisplayCode && !matchOwner && !matchSurveyor) {
          return false;
        }
      }

      if (activeTab === 'MASTER_AREA') return isMasterAreaRow(item);
      if (activeTab === 'CONDO_UNIT') return isChildUnitRow(item);
      if (activeTab === 'PENDING') {
        return item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW';
      }
      if (activeTab === 'CRITICAL') return isCriticalRow(item);
      if (activeTab === 'ABSENT') return isAbsentRow(item);
      if (activeTab === 'GRADE_0') return isGrade0EligibleRow(item);
      if (activeTab === 'REJECTED') return item.status === 'REJECTED';
      if (activeTab === 'APPROVED') return item.status === 'APPROVED';

      return true;
    });
  }, [items, debouncedSearch, activeTab, selectedFloor, isMasterRow]);

  // Tab Counts
  const tabCounts = useMemo(() => {
    const unitList = items.filter((item) => !isMasterRow(item));
    return {
      all: unitList.length,
      masterArea: unitList.filter(isMasterAreaRow).length,
      units: unitList.filter(isChildUnitRow).length,
      pending: unitList.filter((i) => i.status === 'SUBMITTED' || i.status === 'UNDER_REVIEW').length,
      critical: unitList.filter(isCriticalRow).length,
      absent: unitList.filter(isAbsentRow).length,
      grade0: unitList.filter(isGrade0EligibleRow).length,
      rejected: unitList.filter((i) => i.status === 'REJECTED').length,
      approved: unitList.filter((i) => i.status === 'APPROVED').length,
    };
  }, [items, isMasterRow]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Batch Select Handlers
  const handleSelectRow = (reportId: string, checked: boolean) => {
    setSelectedReportIds((prev) =>
      checked ? [...prev, reportId] : prev.filter((id) => id !== reportId)
    );
  };

  const eligibleBatchItems = useMemo(() => {
    return filteredItems.filter((item) => item.report_id && isGrade0EligibleRow(item));
  }, [filteredItems]);

  const handleSelectAllEligible = (checked: boolean) => {
    if (checked) {
      const eligibleIds = eligibleBatchItems
        .map((i) => i.report_id)
        .filter((id): id is string => Boolean(id));
      setSelectedReportIds(eligibleIds);
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleExecuteBatchApprove = async () => {
    if (selectedReportIds.length === 0) return;
    setIsBatchApproving(true);
    try {
      const res = await api.post('/admin/reports/batch-approve', {
        reportIds: selectedReportIds,
        judgementNotes: `Phê duyệt an toàn hàng loạt Grade 0 cho ${towerItem.house_number || towerItem.project_parcel_code}`,
      });
      if (res.data?.success) {
        setSelectedReportIds([]);
        fetchTowerUnitsAndProgress();
        if (onStatsNeedRefresh) onStatsNeedRefresh();
      }
    } catch (err: unknown) {
      console.error('[CondoTowerUnitQueue] Lỗi phê duyệt hàng loạt:', err);
      alert(getErrorMessage(err));
    } finally {
      setIsBatchApproving(false);
    }
  };

  const isAllEligibleSelected =
    eligibleBatchItems.length > 0 &&
    eligibleBatchItems.every((item) => item.report_id && selectedReportIds.includes(item.report_id));

  return (
    <div className="space-y-4">
      {/* Breadcrumbs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={onBackToTowers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Danh sách các tòa</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500 font-medium">Chung Cư</span>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>{towerItem.house_number || towerItem.project_parcel_code}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-100 text-teal-800 border border-teal-200">
              {towerItem.project_parcel_code}
            </span>
          </div>
        </div>

        {progressMeta.isLocked && (
          <div className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 w-fit">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>TÒA ĐÃ KHÓA SỔ PHÁP LÝ (BẤT BIẾN)</span>
          </div>
        )}
      </div>

      {/* Building Master Summary Banner (Separates Master 5-Step Studio, Floor Matrix & Final Seal) */}
      <CondoMasterSummaryBanner
        towerParcelCode={towerItem.project_parcel_code}
        towerName={towerItem.house_number || towerItem.project_parcel_code}
        masterReportId={progressMeta.masterReportId}
        masterReportStatus={progressMeta.masterReportStatus}
        parentMasterSummary={progressMeta.parentMasterSummary}
        floorPlanCount={progressMeta.floorPlanCount}
        totalItems={progressMeta.totalItems}
        completedItems={progressMeta.completedItems}
        isReadyForFinalSeal={progressMeta.isReadyForFinalSeal}
        isParentLocked={progressMeta.isLocked}
        sealHash={progressMeta.sealHash}
        onOpenMasterStudio={(repId) => onOpenStudio(repId)}
        onPreviewMasterReport={(repId) => onPreviewReport(repId)}
        onOpenFloorMatrix={() => setShowFloorMatrixDrawer(true)}
        onOpenFinalSealModal={() => setShowFinalSealModal(true)}
      />

      {/* Filter Tabs, Floor Selector & Search */}
      <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search + Floor Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo mã căn (U-12.04), khu chung (MA-B1), chủ hộ, KSV..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Floor Selector Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedFloor === null ? 'ALL' : String(selectedFloor)}
                onChange={(e) =>
                  setSelectedFloor(e.target.value === 'ALL' ? null : Number(e.target.value))
                }
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="ALL">Tất cả các tầng ({availableFloors.length})</option>
                {availableFloors.map((fl) => (
                  <option key={fl} value={String(fl)}>
                    {fl < 0 ? `Hầm B${Math.abs(fl)}` : `Tầng ${fl}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchTowerUnitsAndProgress}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0 self-end md:self-auto"
            title="Làm mới danh sách căn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {/* Full Status & Entity Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Tất cả</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MASTER_AREA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'MASTER_AREA'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Khu dùng chung (M-xxx)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.masterArea}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONDO_UNIT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'CONDO_UNIT'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>Căn hộ con (U-xxx)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.units}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ duyệt</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.pending}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Nguy hiểm (Cấp ≥ 3)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.critical}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ABSENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ABSENT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Vắng chủ hộ</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.absent}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GRADE_0')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'GRADE_0'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Grade 0 (Duyệt nhanh)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.grade0}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'REJECTED'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Đã trả về</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.rejected}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã phê duyệt</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.approved}</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden relative">
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 border-b border-red-200 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={fetchTowerUnitsAndProgress}
              className="font-bold underline cursor-pointer hover:opacity-80"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-3 w-16 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isAllEligibleSelected}
                      onChange={(e) => handleSelectAllEligible(e.target.checked)}
                      disabled={eligibleBatchItems.length === 0}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        eligibleBatchItems.length > 0
                          ? `Chọn tất cả ${eligibleBatchItems.length} căn Grade 0 đủ điều kiện duyệt hàng loạt`
                          : 'Không có căn Grade 0 nào đủ điều kiện duyệt hàng loạt'
                      }
                    />
                    <span>STT</span>
                  </div>
                </th>
                <th className="py-3 px-3">Mã Hạng Mục / Căn Hộ</th>
                <th className="py-3 px-3">Địa Chỉ &amp; Chủ Hộ</th>
                <th className="py-3 px-3">Kỹ Sư Khảo Sát</th>
                <th className="py-3 px-3 text-center">Cấp Khuyết Tật (Burland)</th>
                <th className="py-3 px-3 text-center">Trạng Thái &amp; Người Duyệt</th>
                <th className="py-3 px-3 text-center">Khuyết Tật &amp; Quy Cách</th>
                <th className="py-3 px-3 text-right">Thao Tác Thẩm Định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="font-semibold text-xs">Đang tải danh sách căn hộ...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DoorOpen className="w-10 h-10 text-slate-300" />
                      <span className="font-bold text-slate-600">
                        Không có căn hộ hoặc khu vực dùng chung nào trong bộ lọc này
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const isSelectable = isGrade0EligibleRow(item);
                  const isChecked = Boolean(
                    item.report_id && selectedReportIds.includes(item.report_id)
                  );

                  return (
                    <ReviewQueueTableRow
                      key={item.report_id || item.unit_id || index}
                      stt={(currentPage - 1) * pageSize + index + 1}
                      item={item}
                      selectable={isSelectable}
                      selected={isChecked}
                      onSelect={handleSelectRow}
                      onOpenStudio={onOpenStudio}
                      onOpenAuditHistory={onOpenAuditHistory}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Hiển thị <strong className="text-slate-800">{paginatedItems.length}</strong> trên tổng số{' '}
              <strong className="text-slate-800">{filteredItems.length}</strong> hạng mục của tòa
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang đầu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-slate-700">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang kế"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang cuối"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Approve Toolbar */}
      {selectedReportIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-medium">
              Đã chọn <strong className="text-emerald-400">{selectedReportIds.length}</strong> căn Grade 0 của{' '}
              <strong>{towerItem.house_number || towerItem.project_parcel_code}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedReportIds([])}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy chọn
            </button>

            <button
              type="button"
              disabled={isBatchApproving}
              onClick={openBatchApprovePinModal}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isBatchApproving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isBatchApproving ? 'Đang duyệt...' : 'Phê Duyệt An Toàn'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Xác Thực 6 Chữ Số Ngẫu Nhiên Khi Phê Duyệt Hàng Loạt Grade 0 */}
      {showBatchApprovePinModal && (() => {
        const isBatchPinMatched =
          generatedBatchPin.length === 6 && enteredBatchPin.trim() === generatedBatchPin;

        return (
          <div className="fixed inset-0 z-[105] isolate flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative z-[106] bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      Xác Nhận Phê Duyệt Hàng Loạt ({selectedReportIds.length} căn)
                    </h3>
                    <p className="text-xs text-slate-600 truncate">
                      Tòa: <strong className="font-mono text-emerald-700">{towerItem.house_number || towerItem.project_parcel_code}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchApprovePinModal(false)}
                  disabled={isBatchApproving}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  Bạn đang chuẩn bị phê duyệt an toàn hàng loạt <strong className="text-slate-900">{selectedReportIds.length} căn hộ Grade 0</strong>. Hồ sơ sau khi duyệt sẽ được khóa bất biến (APPROVED).
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-950">
                        Mã Xác Thực Phê Duyệt (6 chữ số):
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={generateNewBatchPin}
                      disabled={isBatchApproving}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-mono font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Đổi mã</span>
                    </button>
                  </div>

                  <div className="py-2.5 px-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-center gap-2 sm:gap-2.5 shadow-2xs">
                    {generatedBatchPin.split('').map((digit, idx) => (
                      <span
                        key={idx}
                        className="w-9 h-11 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono font-black text-xl flex items-center justify-center select-none tracking-wider"
                      >
                        {digit}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-600 text-center leading-snug">
                    Nhập chính xác <strong className="text-slate-800">6 chữ số</strong> ở trên vào ô bên dưới để xác nhận phê duyệt:
                  </p>

                  <div className="max-w-[240px] mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={enteredBatchPin}
                      onChange={(e) => setEnteredBatchPin(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && isBatchPinMatched && !isBatchApproving) {
                          e.preventDefault();
                          setShowBatchApprovePinModal(false);
                          await handleExecuteBatchApprove();
                        }
                      }}
                      placeholder="Nhập 6 chữ số..."
                      className={`w-full py-2 px-3 rounded-xl bg-white text-slate-900 font-mono font-black text-center text-lg tracking-widest focus:outline-none border-2 transition-all ${
                        isBatchPinMatched
                          ? 'border-emerald-500 ring-2 ring-emerald-500/25'
                          : enteredBatchPin.length === 6
                            ? 'border-rose-500 ring-2 ring-rose-500/20'
                            : 'border-slate-300 focus:border-emerald-500'
                      }`}
                    />
                    {isBatchPinMatched && (
                      <div className="text-center text-[11px] text-emerald-700 font-bold mt-1.5 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mã xác thực khớp chính xác!</span>
                      </div>
                    )}
                    {enteredBatchPin.length === 6 && !isBatchPinMatched && (
                      <div className="text-center text-[11px] text-rose-600 font-bold mt-1.5">
                        Mã xác thực chưa khớp, vui lòng kiểm tra lại.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchApprovePinModal(false)}
                  disabled={isBatchApproving}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={!isBatchPinMatched || isBatchApproving}
                  onClick={async () => {
                    if (!isBatchPinMatched) return;
                    setShowBatchApprovePinModal(false);
                    await handleExecuteBatchApprove();
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isBatchApproving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Xác Nhận Phê Duyệt</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floor Matrix Drawer */}
      <CondoFloorMatrixDrawer
        isOpen={showFloorMatrixDrawer}
        towerName={towerItem.house_number || towerItem.project_parcel_code}
        towerParcelCode={towerItem.project_parcel_code}
        floorMatrix={progressMeta.floorMatrix}
        onClose={() => setShowFloorMatrixDrawer(false)}
        onSelectUnitReport={(repId) => onOpenStudio(repId)}
        onFilterByFloor={(fl) => setSelectedFloor(fl)}
      />

      {/* Final Seal Modal */}
      <CondoFinalSealModal
        isOpen={showFinalSealModal}
        parcelId={towerParcelId}
        projectParcelCode={towerItem.project_parcel_code}
        buildingName={towerItem.house_number || towerItem.project_parcel_code}
        masterReportId={progressMeta.masterReportId}
        masterReportStatus={progressMeta.masterReportStatus}
        totalItems={progressMeta.totalItems}
        completedItems={progressMeta.completedItems}
        isReadyForFinalSeal={progressMeta.isReadyForFinalSeal}
        blockingItems={progressMeta.blockingItems}
        onClose={() => setShowFinalSealModal(false)}
        onSuccess={() => {
          fetchTowerUnitsAndProgress();
          if (onStatsNeedRefresh) onStatsNeedRefresh();
        }}
        onOpenReportStudio={(repId) => onOpenStudio(repId)}
      />
    </div>
  );
};
