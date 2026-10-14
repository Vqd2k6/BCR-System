import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Flag,
  Search,
  RefreshCw,
  Home,
  DoorOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import { ReviewQueueTableRow } from '../ReviewQueueTableRow';

interface Props {
  selectedZone: string;
  onOpenStudio: (reportId: string | null) => void;
  onPreviewReport: (reportId: string | null) => void;
  onOpenRejectModal: (item: PendingSubmissionItem) => void;
  onOpenReassignModal: (item: PendingSubmissionItem) => void;
  onOpenMutationModal: (item: PendingSubmissionItem) => void;
  onOpenReshapeModal?: (item: PendingSubmissionItem) => void;
  onOpenAuditHistory: (reportId: string, itemCode?: string) => void;
  onStatsNeedRefresh?: () => void;
  initialSubTab?: 'ALL' | 'BURLAND' | 'SLA' | 'FLAGS';
}

type UrgentSubTab = 'ALL' | 'BURLAND' | 'SLA' | 'FLAGS';

export const UrgentReviewQueue: React.FC<Props> = ({
  selectedZone,
  onOpenStudio,
  onPreviewReport,
  onOpenRejectModal,
  onOpenReassignModal,
  onOpenMutationModal,
  onOpenReshapeModal,
  onOpenAuditHistory,
  onStatsNeedRefresh,
  initialSubTab = 'ALL',
}) => {
  const [activeTab, setActiveTab] = useState<UrgentSubTab>(initialSubTab);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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
  }, [selectedZone, activeTab]);

  const fetchUrgentSubmissions = async () => {
    if (!selectedZone) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/reports/pending-reviews', {
        params: {
          zoneId: selectedZone,
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
      console.error('[UrgentReviewQueue] Lỗi tải danh sách ca khẩn cấp:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrgentSubmissions();
  }, [selectedZone]);

  // Master Urgent Filter: only items that are Critical Burland OR Overdue SLA with defects OR has Audit Alert Flags
  const allUrgentItems = useMemo(() => {
    return items.filter((item) => {
      const isCriticalBurland =
        ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(item.burland_damage_category || '') ||
        (item.burland_score ?? 0) >= 3 ||
        (item.burland_max_crack_width_mm ?? 0) >= 2.0;

      const submittedTime = new Date(item.created_at || item.updated_at).getTime();
      const diffHours = (Date.now() - submittedTime) / (1000 * 60 * 60);

      // Chỉ coi là khẩn cấp do quá hạn nếu hồ sơ thực tế có phát hiện vết nứt / khuyết tật
      const hasDefects = Number(item.defect_count) > 0 || (item.burland_score ?? 0) >= 1;
      const isOverdueSla = item.status === 'SUBMITTED' && diffHours >= 48 && hasDefects;

      const hasFlags = Number(item.alert_count) > 0;

      return isCriticalBurland || isOverdueSla || hasFlags;
    });
  }, [items]);

  // Tab Filtering & Search
  const filteredItems = useMemo(() => {
    return allUrgentItems.filter((item) => {
      // Search
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchCode = (item.project_parcel_code || '').toLowerCase().includes(q);
        const matchHouse = (item.house_number || '').toLowerCase().includes(q);
        const matchStreet = (item.street || '').toLowerCase().includes(q);
        const matchUnit = (item.unit_code || '').toLowerCase().includes(q);
        const matchSurveyor = (item.surveyor_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchHouse && !matchStreet && !matchUnit && !matchSurveyor) {
          return false;
        }
      }

      // Tab sub-filter
      if (activeTab === 'BURLAND') {
        return ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(item.burland_damage_category || '');
      }
      if (activeTab === 'SLA') {
        const submittedTime = new Date(item.created_at || item.updated_at).getTime();
        const diffHours = (Date.now() - submittedTime) / (1000 * 60 * 60);
        const hasDefects = Number(item.defect_count) > 0 || (item.burland_score ?? 0) >= 1;
        return item.status === 'SUBMITTED' && diffHours >= 48 && hasDefects;
      }
      if (activeTab === 'FLAGS') {
        return Number(item.alert_count) > 0;
      }
      return true;
    });
  }, [allUrgentItems, debouncedSearch, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allUrgentItems.length,
      burland: allUrgentItems.filter((i) =>
        ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(i.burland_damage_category || '') ||
        (i.burland_score ?? 0) >= 3 ||
        (i.burland_max_crack_width_mm ?? 0) >= 2.0
      ).length,
      sla: allUrgentItems.filter((i) => {
        const diffHours = (Date.now() - new Date(i.created_at || i.updated_at).getTime()) / (1000 * 60 * 60);
        const hasDefects = Number(i.defect_count) > 0 || (i.burland_score ?? 0) >= 1;
        return i.status === 'SUBMITTED' && diffHours >= 48 && hasDefects;
      }).length,
      flags: allUrgentItems.filter((i) => Number(i.alert_count) > 0).length,
    };
  }, [allUrgentItems]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 border border-red-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-500/20 text-red-600 border border-red-500/30 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>Trung Tâm Xử Lý Khẩn Cấp Toàn Zone</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 animate-pulse">
                Ưu tiên thẩm định
              </span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Tập hợp tất cả các ca nứt dầm/cột kết cấu (Burland ≥ 3), các hồ sơ quá hạn xử lý 48 giờ và cờ cảnh báo kiểm toán.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchUrgentSubmissions}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo số nhà, mã căn, địa chỉ, KSV..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span>Tất cả ca khẩn</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BURLAND')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'BURLAND'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>Nứt kết cấu (≥ Cấp 3)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.burland}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SLA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'SLA'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Quá hạn SLA 48h (Có khuyết tật)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.sla}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FLAGS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'FLAGS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Cờ kiểm toán</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.flags}</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchUrgentSubmissions} className="font-bold underline cursor-pointer hover:opacity-80">
              Thử lại
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3">Xuất Xứ & Đối Tượng</th>
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
                      <RefreshCw className="w-6 h-6 animate-spin text-red-600" />
                      <span className="font-semibold text-xs">Đang quét các ca khẩn cấp...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-10 h-10 text-emerald-500" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Tuyệt vời! Không có ca khẩn cấp nào tồn đọng
                      </span>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Toàn bộ các ca nứt nghiêm trọng hoặc quá hạn 48h trong phân khu đã được giải quyết xong.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => (
                  <ReviewQueueTableRow
                    key={item.report_id || item.parcel_id || index}
                    stt={(currentPage - 1) * pageSize + index + 1}
                    item={item}
                    onOpenStudio={onOpenStudio}
                    onOpenAuditHistory={onOpenAuditHistory}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Hiển thị <strong className="text-slate-800 dark:text-slate-200">{paginatedItems.length}</strong> trên tổng số{' '}
              <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong> ca khẩn cấp
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
    </div>
  );
};
