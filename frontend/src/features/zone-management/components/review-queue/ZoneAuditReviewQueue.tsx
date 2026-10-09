import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  FileCheck2,
  XCircle,
  ShieldAlert,
  Building,
  Home,
  UserX,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  FileText,
  User,
  MapPin,
  ExternalLink,
  ArrowRightLeft,
  Split,
  SlidersHorizontal,
} from 'lucide-react';
import { Card } from '../../../../core/components/ui/Card';
import { Badge } from '../../../../core/components/ui/Badge';
import { Button } from '../../../../core/components/ui/Button';
import { api } from '../../../../services/api';
import { AuditStudioModal } from './AuditStudioModal';
import { RejectReportModal } from './RejectReportModal';
import { AdminReassignParcelModal } from './AdminReassignParcelModal';
import { UnifiedGisMutationModal } from '../../../../components/gis/cadastral-editor/UnifiedGisMutationModal';
import { CadastralBoundaryReshapeModal } from '../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import type { GisParcel } from '../../../../components/gis/shared/types';
import { ReviewQueueTableRow } from './ReviewQueueTableRow';

export interface PendingSubmissionItem {
  report_id: string | null;
  parcel_id: string;
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
  burland_max_crack_width_mm: number | null;
  ecs_score: number | null;
  vi_score: number | null;
  defect_count: number;
  alert_count: number;
  owner_name?: string | null;
  land_area_m2?: number | null;
}

export type TabType = 'ALL' | 'RESIDENTIAL' | 'CONDO' | 'ABSENT' | 'CRITICAL' | 'REJECTED' | 'APPROVED';

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
  defaultTab = 'ALL',
  title,
}) => {
  const [items, setItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Filtering states
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination states (25, 50, 100 rows)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [selectedAuditReportId, setSelectedAuditReportId] = useState<string | null>(null);
  const [auditStudioOpen, setAuditStudioOpen] = useState(false);

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
  const [isLoadingReshapeParcel, setIsLoadingReshapeParcel] = useState(false);

  const handleOpenReshape = async (item: PendingSubmissionItem) => {
    setIsLoadingReshapeParcel(true);
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
    } catch (err) {
      console.error('[ZoneAuditReviewQueue] Lỗi tải chi tiết thửa để nắn chỉnh:', err);
      showToast('Không thể tải dữ liệu thửa đất để nắn chỉnh.');
    } finally {
      setIsLoadingReshapeParcel(false);
    }
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page when zone or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedZone, activeTab, externalFilterCategory, externalFilterValue]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
    fetchSubmissions();
    if (onStatsNeedRefresh) onStatsNeedRefresh();
  };

  // Fetch pending submissions from API
  const fetchSubmissions = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/reports/pending-reviews', {
        params: {
          zoneId: selectedZone,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
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
      console.error('[ZoneAuditReviewQueue] Error loading submissions:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể tải danh sách hồ sơ chờ duyệt.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [selectedZone, statusFilter]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: items.filter((i) => i.status !== 'APPROVED').length,
      residential: items.filter(
        (i) =>
          i.status !== 'APPROVED' &&
          (i.building_type === 'RESIDENTIAL' || (!i.building_type?.includes('CONDO') && !i.is_refused_or_absent))
      ).length,
      condo: items.filter((i) => i.status !== 'APPROVED' && i.building_type?.includes('CONDO')).length,
      absent: items.filter((i) => i.status === 'POSTPONED_ABSENT' || i.is_refused_or_absent).length,
      critical: items.filter(
        (i) =>
          i.status !== 'APPROVED' &&
          (['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(i.burland_damage_category || '') ||
            Number(i.alert_count) > 0 ||
            Number(i.ecs_score) >= 70)
      ).length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
    };
  }, [items]);

  // Filtered Items (Client-side memory cache with instant feedback)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. External filter từ Dashboard click-to-filter
      if (externalFilterCategory === 'CRITICAL') {
        if (item.status === 'APPROVED') return false;
        const isHighBurland = ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(item.burland_damage_category || '');
        const hasAlerts = Number(item.alert_count) > 0;
        const isEcsHigh = Number(item.ecs_score) >= 70;
        if (!isHighBurland && !hasAlerts && !isEcsHigh) return false;
      } else if (externalFilterCategory === 'BURLAND') {
        if (externalFilterValue === 'GRADE_4_5') {
          if (item.burland_damage_category !== 'GRADE_4' && item.burland_damage_category !== 'GRADE_5') return false;
        } else if (externalFilterValue === 'GRADE_3') {
          if (item.burland_damage_category !== 'GRADE_3') return false;
        } else if (externalFilterValue === 'GRADE_1_2') {
          if (item.burland_damage_category !== 'GRADE_1' && item.burland_damage_category !== 'GRADE_2') return false;
        }
      } else if (externalFilterCategory === 'SLA') {
        const itemTime = new Date(item.updated_at || item.created_at).getTime();
        const diffHours = (Date.now() - itemTime) / (3600 * 1000);
        if (externalFilterValue === 'OVERDUE_48H') {
          if (item.status !== 'SUBMITTED' || diffHours < 48) return false;
        } else if (externalFilterValue === 'WARNING_24H') {
          if (item.status !== 'SUBMITTED' || diffHours < 24 || diffHours >= 48) return false;
        }
      } else if (externalFilterCategory === 'STATUS') {
        if (externalFilterValue && item.status !== externalFilterValue) return false;
      }

      // 2. Tab filter
      if (!externalFilterCategory) {
        if (activeTab === 'ALL') {
          if (item.status === 'APPROVED') return false;
        } else if (activeTab === 'RESIDENTIAL') {
          if (item.status === 'APPROVED') return false;
          const isCondo = item.building_type?.includes('CONDO');
          if (isCondo) return false;
        } else if (activeTab === 'CONDO') {
          if (item.status === 'APPROVED') return false;
          const isCondo = item.building_type?.includes('CONDO');
          if (!isCondo) return false;
        } else if (activeTab === 'ABSENT') {
          const isAbsent = item.status === 'POSTPONED_ABSENT' || item.is_refused_or_absent;
          if (!isAbsent) return false;
        } else if (activeTab === 'CRITICAL') {
          if (item.status === 'APPROVED') return false;
          const isHighBurland = ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(item.burland_damage_category || '');
          const hasAlerts = Number(item.alert_count) > 0;
          const isHighEcs = Number(item.ecs_score) >= 70;
          if (!isHighBurland && !hasAlerts && !isHighEcs) return false;
        } else if (activeTab === 'REJECTED') {
          if (item.status !== 'REJECTED') return false;
        } else if (activeTab === 'APPROVED') {
          if (item.status !== 'APPROVED') return false;
        }
      }

      // 3. Search query
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const codeMatch = item.project_parcel_code?.toLowerCase().includes(q);
        const streetMatch = `${item.house_number || ''} ${item.street || ''}`.toLowerCase().includes(q);
        const surveyorMatch = item.surveyor_name?.toLowerCase().includes(q);
        const zoneMatch = item.zone_id?.toLowerCase().includes(q);
        if (!codeMatch && !streetMatch && !surveyorMatch && !zoneMatch) return false;
      }

      return true;
    });
  }, [items, activeTab, debouncedSearch, externalFilterCategory, externalFilterValue]);

  // Pagination calculation
  const totalFilteredCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, startIndex, endIndex]);

  // Xem trước báo cáo kỹ thuật (HTML/PDF preview)
  const handlePreviewReport = (reportId: string | null) => {
    if (!reportId) {
      alert('Hồ sơ này chưa có báo cáo kỹ thuật hoàn chỉnh để xem trước.');
      return;
    }
    const previewUrl = `/api/v1/v2/reports/${reportId}/preview/html`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  // Open Audit Studio
  const handleOpenStudio = (reportId: string | null) => {
    if (!reportId) {
      alert('Không tìm thấy ID báo cáo kỹ thuật.');
      return;
    }
    setSelectedAuditReportId(reportId);
    setAuditStudioOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800">
                  {title || 'Hàng Đợi Thẩm Định & Phê Duyệt Hồ Sơ'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {totalFilteredCount} hồ sơ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quy trình kiểm soát chất lượng 2 lớp cho Trưởng Zone: Kiểm tra ảnh có thước đo tỷ lệ, đối soát hiện trạng nứt và cấp duyệt báo cáo BCS.
              </p>
            </div>
          </div>
        </div>

        {/* Search Box & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm mã thửa, địa chỉ, KSV..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          <button
            type="button"
            onClick={fetchSubmissions}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Làm mới hàng đợi"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 border-b border-slate-100 flex items-center gap-2 overflow-x-auto bg-white py-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Tất cả chờ xử lý</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RESIDENTIAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'RESIDENTIAL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Nhà dân Phase 1</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'RESIDENTIAL' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.residential}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONDO')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'CONDO'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Chung cư con</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'CONDO' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.condo}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ABSENT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ABSENT'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Vắng chủ hộ</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'ABSENT' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {tabCounts.absent}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CRITICAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'CRITICAL'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-red-700 hover:bg-red-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Nguy cơ cao (Cấp ≥ 3 / Cờ lỗi)</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'CRITICAL' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-800'}`}>
            {tabCounts.critical}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REJECTED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'REJECTED'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Đã trả về</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'REJECTED' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.rejected}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPROVED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã phê duyệt</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
            {tabCounts.approved}
          </span>
        </button>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* High-Performance Paginated Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200 select-none text-[11px] tracking-wide">
            <tr>
              <th className="p-3.5 whitespace-nowrap">Mã Thửa / Phân Khu</th>
              <th className="p-3.5 min-w-[200px]">Địa Chỉ & Loại CT</th>
              <th className="p-3.5 whitespace-nowrap">Khảo Sát Viên</th>
              <th className="p-3.5 text-center whitespace-nowrap">Trạng Thái Hồ Sơ</th>
              <th className="p-3.5 text-center whitespace-nowrap">Cấp Nguy Cơ (Burland)</th>
              <th className="p-3.5 text-center whitespace-nowrap">Khuyết Tật</th>
              <th className="p-3.5 text-center whitespace-nowrap">Cảnh Báo Kỹ Thuật</th>
              <th className="p-3.5 text-right whitespace-nowrap">Thao Tác Thẩm Định</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-sky-600" />
                  <span className="font-semibold">Đang tải danh sách hồ sơ cần thẩm định...</span>
                </td>
              </tr>
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400">
                  <FileCheck2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <div className="text-sm font-bold text-slate-600">Không có hồ sơ nào thỏa mãn điều kiện lọc</div>
                  <p className="text-xs text-slate-400 mt-1">
                    Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.
                  </p>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <ReviewQueueTableRow
                  key={item.parcel_id}
                  item={item}
                  onOpenStudio={handleOpenStudio}
                  onPreviewReport={handlePreviewReport}
                  onOpenRejectModal={(it) =>
                    setRejectModalData({
                      reportId: it.report_id!,
                      parcelCode: it.project_parcel_code,
                      surveyorName: it.surveyor_name || undefined,
                    })
                  }
                  onOpenReassignModal={(it) =>
                    setReassignModalData({
                      reportId: it.report_id!,
                      parcelCode: it.project_parcel_code,
                      parcelId: it.parcel_id,
                      houseNumber: it.house_number,
                      street: it.street,
                      surveyorName: it.surveyor_name || undefined,
                      zoneId: it.zone_id,
                    })
                  }
                  onOpenMutationModal={(it) =>
                    setMutationModalData({
                      parcelId: it.parcel_id,
                      parcelCode: it.project_parcel_code,
                      houseNumber: it.house_number,
                      street: it.street,
                      currentAreaM2: it.land_area_m2 || 0,
                      zoneId: it.zone_id,
                      reportId: it.report_id || undefined,
                    })
                  }
                  onOpenReshapeModal={handleOpenReshape}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left summary & Page Size selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-slate-500">
            Hiển thị <strong>{totalFilteredCount > 0 ? startIndex + 1 : 0}</strong> - <strong>{endIndex}</strong> / <strong>{totalFilteredCount}</strong> hồ sơ
          </span>

          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-slate-400 text-[11px]">Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
              <option value={100}>100 / trang</option>
            </select>
          </div>
        </div>

        {/* Right Pagination Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(1)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            title="Về trang đầu"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            title="Trang trước"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="px-3 py-1 font-bold font-mono text-xs text-slate-800 bg-white border border-slate-200 rounded-lg">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            title="Trang sau"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
            title="Đến trang cuối"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {/* Audit Studio Modal */}
      {selectedAuditReportId && (
        <AuditStudioModal
          isOpen={auditStudioOpen}
          reportId={selectedAuditReportId}
          onClose={() => {
            setAuditStudioOpen(false);
            setSelectedAuditReportId(null);
          }}
          onRefreshList={() => {
            fetchSubmissions();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Reject Report Modal */}
      {rejectModalData && (
        <RejectReportModal
          isOpen={!!rejectModalData}
          reportId={rejectModalData.reportId}
          parcelCode={rejectModalData.parcelCode}
          surveyorName={rejectModalData.surveyorName}
          onClose={() => setRejectModalData(null)}
          onSuccess={(msg) => {
            showToast(msg || 'Đã trả về báo cáo khảo sát yêu cầu đo lại.');
            setRejectModalData(null);
          }}
        />
      )}

      {/* Reassign / Spatial Swap Modal */}
      {reassignModalData && (
        <AdminReassignParcelModal
          isOpen={!!reassignModalData}
          reportId={reassignModalData.reportId}
          currentParcelId={reassignModalData.parcelId}
          currentParcelCode={reassignModalData.parcelCode}
          currentHouseNumber={reassignModalData.houseNumber}
          currentStreet={reassignModalData.street}
          surveyorName={reassignModalData.surveyorName}
          zoneId={reassignModalData.zoneId || selectedZone || 'ZONE_01'}
          onClose={() => setReassignModalData(null)}
          onSuccess={(msg) => {
            showToast(msg || 'Đã hoán đổi vị trí ranh đất GIS thành công.');
            setReassignModalData(null);
            fetchSubmissions();
          }}
        />
      )}

      {/* Unified GIS Mutation Modal */}
      {mutationModalData && (
        <UnifiedGisMutationModal
          isOpen={!!mutationModalData}
          parcelId={mutationModalData.parcelId}
          parcelCode={mutationModalData.parcelCode}
          houseNumber={mutationModalData.houseNumber}
          street={mutationModalData.street}
          currentAreaM2={mutationModalData.currentAreaM2}
          initialZoneId={mutationModalData.zoneId}
          reportId={mutationModalData.reportId}
          onClose={() => setMutationModalData(null)}
          onSuccess={(msg?: string) => {
            showToast(msg || 'Đã thực hiện biến động ranh đất GIS thành công.');
            setMutationModalData(null);
          }}
        />
      )}

      {/* Cadastral Boundary Reshape Modal */}
      {reshapeModalParcel && (
        <CadastralBoundaryReshapeModal
          isOpen={!!reshapeModalParcel}
          parcel={reshapeModalParcel}
          onClose={() => setReshapeModalParcel(null)}
          onSuccess={(res) => {
            showToast(res?.message || 'Đã nắn chỉnh ranh giới thửa đất thành công.');
            setReshapeModalParcel(null);
            fetchSubmissions();
          }}
        />
      )}
    </div>
  );
};
