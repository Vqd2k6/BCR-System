import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Home,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import { ReviewQueueTableRow } from '../ReviewQueueTableRow';
import type { GisParcel } from '../../../../../components/gis/shared/types';

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
}

type ResidentialTab = 'ALL' | 'CRITICAL' | 'SLA' | 'REJECTED' | 'APPROVED';

export const ResidentialReviewQueue: React.FC<Props> = ({
  selectedZone,
  onOpenStudio,
  onPreviewReport,
  onOpenRejectModal,
  onOpenReassignModal,
  onOpenMutationModal,
  onOpenReshapeModal,
  onOpenAuditHistory,
  onStatsNeedRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<ResidentialTab>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Debounce search input (300ms)
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

  const fetchResidentialSubmissions = async () => {
    if (!selectedZone) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/reports/pending-reviews', {
        params: {
          zoneId: selectedZone,
          filterLevel: 'RESIDENTIAL',
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
      console.error('[ResidentialReviewQueue] Lỗi tải dữ liệu nhà dân:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidentialSubmissions();
  }, [selectedZone]);

  // Tab Filtering & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search query filter
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchCode = (item.project_parcel_code || '').toLowerCase().includes(q);
        const matchHouse = (item.house_number || '').toLowerCase().includes(q);
        const matchStreet = (item.street || '').toLowerCase().includes(q);
        const matchSurveyor = (item.surveyor_name || '').toLowerCase().includes(q);
        const matchOwner = (item.owner_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchHouse && !matchStreet && !matchSurveyor && !matchOwner) {
          return false;
        }
      }

      // Tab sub-filter
      if (activeTab === 'CRITICAL') {
        return ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(item.burland_damage_category || '');
      }
      if (activeTab === 'SLA') {
        if (item.status !== 'SUBMITTED') return false;
        const submittedTime = new Date(item.created_at || item.updated_at).getTime();
        const diffHours = (Date.now() - submittedTime) / (1000 * 60 * 60);
        return diffHours >= 48;
      }
      if (activeTab === 'REJECTED') {
        return item.status === 'REJECTED';
      }
      if (activeTab === 'APPROVED') {
        return item.status === 'APPROVED';
      }
      // 'ALL': show pending items (submitted or absent)
      return item.status === 'SUBMITTED' || item.status === 'POSTPONED_ABSENT';
    });
  }, [items, debouncedSearch, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: items.filter((i) => i.status === 'SUBMITTED' || i.status === 'POSTPONED_ABSENT').length,
      critical: items.filter((i) => ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(i.burland_damage_category || '')).length,
      sla: items.filter((i) => {
        if (i.status !== 'SUBMITTED') return false;
        const diffHours = (Date.now() - new Date(i.created_at || i.updated_at).getTime()) / (1000 * 60 * 60);
        return diffHours >= 48;
      }).length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
    };
  }, [items]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Sub-Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo số nhà, tên đường, mã thửa, KSV..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Chờ duyệt</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'CRITICAL'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Nguy cơ cao</span>
            {tabCounts.critical > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-800 animate-pulse">
                {tabCounts.critical}
              </span>
            )}
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
            <span>Quá hạn 48h</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.sla}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã duyệt</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tabCounts.approved}</span>
          </button>

          <button
            type="button"
            onClick={fetchResidentialSubmissions}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={fetchResidentialSubmissions}
              className="font-bold underline cursor-pointer hover:opacity-80"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3">Thửa Đất & Phân Khu</th>
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
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="font-semibold text-xs">Đang tải danh sách nhà dân...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Home className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                      <span className="font-bold text-slate-600 dark:text-slate-400">
                        Không có hồ sơ nhà dân nào trong danh mục này
                      </span>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Tất cả các thửa đất nhà phố/biệt thự độc lập thuộc phân khu này đã được xử lý hoặc chưa phát sinh khảo sát.
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
              <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length}</strong> hồ sơ nhà dân
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
