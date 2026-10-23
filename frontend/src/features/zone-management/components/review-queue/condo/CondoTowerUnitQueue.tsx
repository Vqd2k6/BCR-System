import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import { ReviewQueueTableRow } from '../ReviewQueueTableRow';

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

type TowerUnitTab = 'ALL' | 'MASTER_AREA' | 'CONDO_UNIT' | 'ABSENT' | 'GRADE_0';

export const CondoTowerUnitQueue: React.FC<Props> = ({
  towerParcelId,
  towerItem,
  onBackToTowers,
  onOpenStudio,
  onPreviewReport,
  onOpenRejectModal,
  onOpenReassignModal,
  onOpenMutationModal,
  onOpenReshapeModal,
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

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
  }, [towerParcelId, activeTab]);

  const fetchTowerUnits = async () => {
    if (!towerParcelId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/reports/pending-reviews', {
        params: {
          parcelId: towerParcelId,
          limit: 200,
        },
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        setItems(res.data.data);
      } else if (res.data?.success && Array.isArray(res.data.data?.items)) {
        setItems(res.data.data.items);
      } else {
        setItems([]);
      }
    } catch (err: unknown) {
      console.error('[CondoTowerUnitQueue] Lỗi tải danh sách căn của tòa:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTowerUnits();
  }, [towerParcelId]);

  // Tab Filtering & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Don't show the parent tower row itself in unit list
      if (item.report_type === 'CONDO_PARENT_MASTER' || (item.building_type === 'CONDOMINIUM' && !item.unit_id && item.parcel_id === towerParcelId && !item.unit_code)) {
        return false;
      }

      // Search query filter
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

      // Tab sub-filter
      if (activeTab === 'MASTER_AREA') {
        return item.unit_type === 'MASTER' || item.unit_type === 'MASTER_AREA' || (item.unit_code && item.unit_code.startsWith('M-')) || item.report_type === 'MASTER_AREA';
      }
      if (activeTab === 'CONDO_UNIT') {
        return item.unit_type === 'UNIT' || (item.unit_code && item.unit_code.startsWith('U-')) || item.report_type === 'CONDO_UNIT' || item.report_type === 'UNIT_CHILD';
      }
      if (activeTab === 'ABSENT') {
        return (
          item.is_refused_or_absent ||
          item.status === 'POSTPONED_ABSENT' ||
          item.unit_status === 'POSTPONED_ABSENT' ||
          item.unit_status === 'POSTPONED_ABSENT_VERIFIED'
        );
      }
      if (activeTab === 'GRADE_0') {
        return (
          item.status === 'SUBMITTED' &&
          !item.has_admin_diff &&
          (item.version_count ?? 0) <= 1 &&
          Number(item.defect_count) === 0 &&
          (item.burland_damage_category === 'GRADE_0' || !item.burland_damage_category)
        );
      }
      return true;
    });
  }, [items, debouncedSearch, activeTab, towerParcelId]);

  // Tab Counts
  const tabCounts = useMemo(() => {
    const unitList = items.filter((item) => !(item.report_type === 'CONDO_PARENT_MASTER' || (item.building_type === 'CONDOMINIUM' && !item.unit_id && item.parcel_id === towerParcelId && !item.unit_code)));
    return {
      all: unitList.length,
      masterArea: unitList.filter((i) => i.unit_type === 'MASTER' || i.unit_type === 'MASTER_AREA' || (i.unit_code && i.unit_code.startsWith('M-')) || i.report_type === 'MASTER_AREA').length,
      units: unitList.filter((i) => i.unit_type === 'UNIT' || (i.unit_code && i.unit_code.startsWith('U-')) || i.report_type === 'CONDO_UNIT' || i.report_type === 'UNIT_CHILD').length,
      absent: unitList.filter((i) => i.is_refused_or_absent || i.status === 'POSTPONED_ABSENT' || i.unit_status === 'POSTPONED_ABSENT' || i.unit_status === 'POSTPONED_ABSENT_VERIFIED').length,
      grade0: unitList.filter((i) => i.status === 'SUBMITTED' && !i.has_admin_diff && (i.version_count ?? 0) <= 1 && Number(i.defect_count) === 0 && (i.burland_damage_category === 'GRADE_0' || !i.burland_damage_category)).length,
    };
  }, [items, towerParcelId]);

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
    return filteredItems.filter(
      (item) =>
        item.report_id &&
        item.status === 'SUBMITTED' &&
        !item.has_admin_diff &&
        (item.version_count ?? 0) <= 1 &&
        Number(item.defect_count) === 0 &&
        (item.burland_damage_category === 'GRADE_0' || !item.burland_damage_category)
    );
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
        notes: `Phê duyệt an toàn hàng loạt Grade 0 cho ${towerItem.house_number || towerItem.project_parcel_code}`,
      });
      if (res.data?.success) {
        setSelectedReportIds([]);
        fetchTowerUnits();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={onBackToTowers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Danh sách các tòa</span>
          </button>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-500 font-medium">Chung Cư</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>{towerItem.house_number || towerItem.project_parcel_code}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {towerItem.project_parcel_code}
            </span>
          </div>
        </div>

        {towerItem.parent_parcel_is_locked && (
          <div className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5 w-fit">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>TÒA ĐÃ KHÓA SỔ PHÁP LÝ (BẤT BIẾN)</span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo mã căn (U-12.04), chủ hộ, KSV..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>Căn hộ con (U-xxx)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.units}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ABSENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ABSENT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Grade 0 (0 khuyết tật)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.grade0}</span>
          </button>

          <button
            type="button"
            onClick={fetchTowerUnits}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            title="Làm mới danh sách căn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden relative">
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchTowerUnits} className="font-bold underline cursor-pointer hover:opacity-80">
              Thử lại
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] tracking-wider">
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
                <th className="py-3 px-3">Địa Chỉ & Chủ Hộ</th>
                <th className="py-3 px-3">Kỹ Sư Khảo Sát</th>
                <th className="py-3 px-3 text-center">Cấp Khuyết Tật (Burland)</th>
                <th className="py-3 px-3 text-center">Trạng Thái & Người Duyệt</th>
                <th className="py-3 px-3 text-center">Khuyết Tật & Quy Cách</th>
                <th className="py-3 px-3 text-right">Thao Tác Thẩm Định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                      <DoorOpen className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                      <span className="font-bold text-slate-600 dark:text-slate-400">
                        Không có căn hộ nào trong danh mục này
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const isSelectable =
                    item.status === 'SUBMITTED' &&
                    Number(item.defect_count) === 0 &&
                    (item.burland_damage_category === 'GRADE_0' || !item.burland_damage_category);
                  const isChecked = Boolean(item.report_id && selectedReportIds.includes(item.report_id));

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
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Hiển thị <strong className="text-slate-800 dark:text-slate-200">{paginatedItems.length}</strong> trên tổng số{' '}
              <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong> hạng mục của tòa
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang đầu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-slate-700 dark:text-slate-300">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang kế"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
              onClick={handleExecuteBatchApprove}
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
    </div>
  );
};
