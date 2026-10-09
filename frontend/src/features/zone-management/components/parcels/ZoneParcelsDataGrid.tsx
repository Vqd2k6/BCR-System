import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Eye,
  Layers,
  ArrowUpDown,
  Home,
  Phone,
  User,
  Move,
  Building2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import type { GisParcel } from '../../../../components/gis/shared/types';
import { CadastralBoundaryReshapeModal } from '../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import { FloorPlanCadManagementModal } from '../../../../components/survey/building-hub/components/FloorPlanCadManagementModal';
import { getErrorMessage } from '@/utils/errorUtils';

interface ZoneParcelsDataGridProps {
  selectedZone: string;
  initialParcels?: GisParcel[];
  onNavigateToMap?: (parcel: GisParcel) => void;
  onViewSurvey?: (parcel: GisParcel) => void;
  onRefreshStats?: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  APPROVED: {
    label: 'Đã phê duyệt',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  SUBMITTED: {
    label: 'Chờ thẩm định',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'Đang khảo sát',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Clock,
  },
  POSTPONED_ABSENT: {
    label: 'Vắng mặt',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: AlertTriangle,
  },
  REJECTED: {
    label: 'Từ chối duyệt',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
  },
  NOT_SURVEYED: {
    label: 'Chưa khảo sát',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    icon: HelpCircle,
  },
};

export const ZoneParcelsDataGrid: React.FC<ZoneParcelsDataGridProps> = ({
  selectedZone,
  initialParcels,
  onNavigateToMap,
  onViewSurvey,
  onRefreshStats,
}) => {
  const [parcels, setParcels] = useState<GisParcel[]>(initialParcels || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>('ALL');
  
  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sorting
  const [sortField, setSortField] = useState<keyof GisParcel>('projectParcelCode');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Selected row for detail drawer
  const [inspectParcel, setInspectParcel] = useState<GisParcel | null>(null);

  // Reshape Modal state
  const [reshapeModalParcel, setReshapeModalParcel] = useState<GisParcel | null>(null);

  // Condo CAD & Unit Partition Modal state
  const [cadModalParcel, setCadModalParcel] = useState<GisParcel | null>(null);
  const [condoConversionTarget, setCondoConversionTarget] = useState<GisParcel | null>(null);
  const [isConvertingCondo, setIsConvertingCondo] = useState<boolean>(false);

  // Chuyển đổi thửa đất sang Chung cư
  const handleConvertToCondo = async (parcel: GisParcel) => {
    setIsConvertingCondo(true);
    try {
      await api.patch(`/parcels/${parcel.id}/building-type`, {
        buildingType: 'CONDOMINIUM',
      });
      // Cập nhật state thửa đất
      setParcels((prev) =>
        prev.map((p) => (p.id === parcel.id ? { ...p, buildingType: 'CONDOMINIUM' } : p))
      );
      if (onRefreshStats) onRefreshStats();
      setCondoConversionTarget(null);
      // Mở ngay modal upload CAD để Zone Admin cấu hình
      setCadModalParcel({ ...parcel, buildingType: 'CONDOMINIUM' });
    } catch (err: unknown) {
      alert(`Lỗi khi chuyển đổi sang chung cư: ${getErrorMessage(err, 'Lỗi mạng')}`);
    } finally {
      setIsConvertingCondo(false);
    }
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load parcels from API when selectedZone changes
  const fetchZoneParcels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/parcels/zone-map', {
        params: { zoneId: selectedZone },
      });
      const rawList = res.data?.data && Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      const mapped: GisParcel[] = (rawList as Record<string, unknown>[]).map((raw) => ({
        ...raw,
        id: String(raw.id || ''),
        projectParcelCode: String(raw.project_parcel_code || raw.projectParcelCode || 'CHƯA_GÁN'),
        officialCadastralCode: String(raw.official_cadastral_code || raw.officialCadastralCode || ''),
        houseNumber: String(raw.house_number || raw.houseNumber || ''),
        street: String(raw.street || ''),
        ownerName: String(raw.owner_name || raw.ownerName || ''),
        ownerPhone: String(raw.owner_phone || raw.ownerPhone || ''),
        surveyStatus: (raw.survey_status || raw.surveyStatus || 'NOT_SURVEYED') as GisParcel['surveyStatus'],
        buildingType: (raw.building_type || raw.buildingType || 'STANDALONE') as GisParcel['buildingType'],
        floorCount: Number(raw.floor_count ?? raw.floorCount ?? 1),
        constructionArea: Number(raw.construction_area_m2 ?? raw.constructionArea ?? 0),
        landArea: Number(raw.land_area_m2 ?? raw.landArea ?? 0),
        zoneId: String(raw.zone_id || raw.zoneId || selectedZone),
        assignedSurveyorName: String(raw.assigned_surveyor_name || raw.assignedSurveyorName || ''),
        assignedSurveyorCode: String(raw.assigned_surveyor_code || raw.assignedSurveyorCode || ''),
        assignedSurveyorPhone: String(raw.assigned_surveyor_phone || raw.assignedSurveyorPhone || ''),
        absenceAttemptCount: Number(raw.absence_attempt_count ?? raw.absenceAttemptCount ?? 0),
        activePhase1ReportId: (raw.active_phase1_report_id || raw.activePhase1ReportId) as string | undefined,
        coordinates: (Array.isArray(raw.coordinates) ? raw.coordinates : []) as [number, number][],
      }));

      setParcels(mapped);
    } catch (err) {
      console.error('[ZoneParcelsDataGrid] Failed to fetch parcels:', err);
      setParcels([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone]);

  useEffect(() => {
    fetchZoneParcels();
  }, [fetchZoneParcels]);

  // Filtered & Sorted Data
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const pStatus = p.surveyStatus || 'NOT_SURVEYED';
        if (statusFilter === 'POSTPONED_ABSENT') {
          if (pStatus !== 'POSTPONED_ABSENT' && (p.absenceAttemptCount || 0) === 0) return false;
        } else if (pStatus !== statusFilter) {
          return false;
        }
      }

      // 2. Building Type Filter
      if (buildingTypeFilter !== 'ALL') {
        const bType = (p.buildingType || '').toUpperCase();
        if (buildingTypeFilter === 'RESIDENTIAL' && !bType.includes('RESIDENTIAL') && !bType.includes('DÂN') && !bType.includes('PHỐ') && !bType.includes('STANDALONE')) {
          return false;
        }
        if (buildingTypeFilter === 'CONDOMINIUM' && !bType.includes('CONDO') && !bType.includes('CHUNG CƯ')) {
          return false;
        }
        if (buildingTypeFilter === 'INDUSTRIAL' && !bType.includes('XƯỞNG') && !bType.includes('KHO') && !bType.includes('INDUSTRIAL')) {
          return false;
        }
      }

      // 3. Search Query
      if (debouncedSearch) {
        const code = (p.projectParcelCode || '').toLowerCase();
        const cadastral = (p.officialCadastralCode || '').toLowerCase();
        const owner = (p.ownerName || '').toLowerCase();
        const phone = (p.ownerPhone || '').toLowerCase();
        const house = (p.houseNumber || '').toLowerCase();
        const street = (p.street || '').toLowerCase();
        const surveyor = (p.assignedSurveyorName || '').toLowerCase();

        const match =
          code.includes(debouncedSearch) ||
          cadastral.includes(debouncedSearch) ||
          owner.includes(debouncedSearch) ||
          phone.includes(debouncedSearch) ||
          house.includes(debouncedSearch) ||
          street.includes(debouncedSearch) ||
          surveyor.includes(debouncedSearch);

        if (!match) return false;
      }

      return true;
    });
  }, [parcels, statusFilter, buildingTypeFilter, debouncedSearch]);

  const sortedParcels = useMemo(() => {
    return [...filteredParcels].sort((a, b) => {
      let aVal = a[sortField] ?? '';
      let bVal = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredParcels, sortField, sortAsc]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedParcels.length / pageSize));
  const paginatedParcels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedParcels.slice(start, start + pageSize);
  }, [sortedParcels, currentPage, pageSize]);

  const handleSort = (field: keyof GisParcel) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'STT',
      'Mã Dự Án',
      'Mã Địa Chính',
      'Chủ Hộ',
      'Số Điện Thoại',
      'Số Nhà',
      'Đường Phố',
      'Khảo Sát Viên',
      'Loại Công Trình',
      'Số Tầng',
      'Diện Tích Sàn (m2)',
      'Diện Tích Đất (m2)',
      'Trạng Thái Khảo Sát',
      'Phân Khu',
    ];

    const rows = sortedParcels.map((p, idx) => [
      idx + 1,
      `"${p.projectParcelCode || ''}"`,
      `"${p.officialCadastralCode || ''}"`,
      `"${(p.ownerName || '').replace(/"/g, '""')}"`,
      `"${p.ownerPhone || ''}"`,
      `"${(p.houseNumber || '').replace(/"/g, '""')}"`,
      `"${(p.street || '').replace(/"/g, '""')}"`,
      `"${(p.assignedSurveyorName || 'Chưa gán').replace(/"/g, '""')}"`,
      `"${p.buildingType || 'Nhà dân dụng'}"`,
      p.floorCount || 1,
      p.constructionArea || 0,
      p.landArea || 0,
      `"${STATUS_CONFIG[p.surveyStatus || 'NOT_SURVEYED']?.label || p.surveyStatus || ''}"`,
      `"${p.zoneId || selectedZone}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `So_Dia_Chinh_${selectedZone}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header Toolbar & Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-800 tracking-tight">
              Sổ Quản Trị Địa Chính Phân Khu
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
              {selectedZone === 'ALL' ? 'Toàn Tuyến' : selectedZone}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý toàn bộ {parcels.length} thửa đất quy hoạch và tiến độ khảo sát hiện trường
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sortedParcels.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Xuất danh sách ra file Excel CSV"
          >
            <Download size={14} className="text-slate-500" />
            <span>Xuất Excel (.csv)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchZoneParcels();
              onRefreshStats?.();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Search & Multi-criteria Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã thửa, Mã địa chính, Tên chủ hộ, Số nhà, Đường..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">✓ Đã phê duyệt</option>
              <option value="SUBMITTED">⏳ Chờ thẩm định</option>
              <option value="IN_PROGRESS">⚡ Đang khảo sát</option>
              <option value="POSTPONED_ABSENT">⚠ Vắng mặt</option>
              <option value="NOT_SURVEYED">⚪ Chưa khảo sát</option>
              <option value="REJECTED">✕ Từ chối duyệt</option>
            </select>
          </div>

          {/* Building Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loại:</span>
            <select
              value={buildingTypeFilter}
              onChange={(e) => {
                setBuildingTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">Tất cả loại hình</option>
              <option value="RESIDENTIAL">Nhà phố / Dân dụng</option>
              <option value="CONDOMINIUM">Chung cư / Căn hộ</option>
              <option value="INDUSTRIAL">Nhà xưởng / Kho</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2.5. Mini Cadastral Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider whitespace-nowrap">Tổng số thửa</span>
          <span className="text-lg font-black text-slate-900 mt-0.5 block">{parcels.length}</span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('APPROVED'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 block uppercase tracking-wider whitespace-nowrap">Đã phê duyệt</span>
          <span className="text-lg font-black text-emerald-700 mt-0.5 block">
            {parcels.filter((p) => p.surveyStatus === 'APPROVED').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('SUBMITTED'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'SUBMITTED'
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-sky-700 block uppercase tracking-wider whitespace-nowrap">Chờ thẩm định</span>
          <span className="text-lg font-black text-sky-700 mt-0.5 block">
            {parcels.filter((p) => p.surveyStatus === 'SUBMITTED').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('IN_PROGRESS'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'IN_PROGRESS'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 block uppercase tracking-wider whitespace-nowrap">Đang khảo sát</span>
          <span className="text-lg font-black text-amber-700 mt-0.5 block">
            {parcels.filter((p) => p.surveyStatus === 'IN_PROGRESS').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('NOT_SURVEYED'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'NOT_SURVEYED'
              ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider whitespace-nowrap">Chưa khảo sát</span>
          <span className="text-lg font-black text-slate-600 mt-0.5 block">
            {parcels.filter((p) => !p.surveyStatus || p.surveyStatus === 'NOT_SURVEYED').length}
          </span>
        </button>
      </div>

      {/* 3. Cadastral Data Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th
                  onClick={() => handleSort('projectParcelCode')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Mã Thửa Đất</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ownerName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Chủ Hộ & SĐT</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[200px]">Địa Chỉ Công Trình</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Quy Mô & Loại Hình</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Khảo Sát Viên</th>
                <th
                  onClick={() => handleSort('surveyStatus')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors select-none text-center whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Trạng Thái Khảo Sát</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Thao Tác Quản Trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    <span className="font-bold">Đang tải danh bạ thửa đất...</span>
                  </td>
                </tr>
              ) : paginatedParcels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Layers size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600">Không tìm thấy thửa đất phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ bớt các tiêu chí lọc
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedParcels.map((parcel) => {
                  const statusConf = STATUS_CONFIG[parcel.surveyStatus || 'NOT_SURVEYED'] || STATUS_CONFIG.NOT_SURVEYED;
                  const StatusIcon = statusConf.icon;

                  return (
                    <tr
                      key={parcel.id}
                      className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                      onClick={() => setInspectParcel(parcel)}
                    >
                      {/* Cột 1: Mã Thửa Đất */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-black text-indigo-700 text-xs group-hover:text-indigo-800">
                          {parcel.projectParcelCode || 'CHƯA_GÁN'}
                        </div>
                        {parcel.officialCadastralCode && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            ĐC: {parcel.officialCadastralCode}
                          </div>
                        )}
                      </td>

                      {/* Cột 2: Chủ Hộ & SĐT */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span>{parcel.ownerName || 'Chưa cập nhật'}</span>
                        </div>
                        {parcel.ownerPhone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{parcel.ownerPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Địa Chỉ */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="text-slate-800 font-semibold truncate max-w-xs xl:max-w-md flex items-center gap-1.5" title={`${parcel.houseNumber || ''} ${parcel.street || ''}`}>
                          <Home size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}
                            {parcel.street || 'Đoạn tuyến chính'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                          {parcel.ward ? `P. ${parcel.ward}, ` : ''}
                          {parcel.district ? `Q. ${parcel.district} • ` : ''}
                          Phân khu: <strong className="text-indigo-600">{parcel.zoneId || selectedZone}</strong>
                        </div>
                      </td>

                      {/* Cột 4: Quy Mô & Loại Hình */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">
                          {parcel.buildingType === 'CONDOMINIUM' ? 'Chung cư' : parcel.buildingType === 'STANDALONE' ? 'Nhà riêng lẻ' : parcel.buildingType || 'Nhà dân dụng'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                          <span>{parcel.floorCount || 1} tầng</span>
                          <span className="text-slate-300">•</span>
                          <span>Sàn: {parcel.constructionArea || 0} m²</span>
                          <span className="text-slate-300">•</span>
                          <span>Đất: {parcel.landArea || 0} m²</span>
                        </div>
                      </td>

                      {/* Cột 5: Khảo Sát Viên */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span>{parcel.assignedSurveyorName || 'Chưa phân công'}</span>
                        </div>
                        {parcel.assignedSurveyorCode && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Mã KSV: {parcel.assignedSurveyorCode}
                          </div>
                        )}
                      </td>

                      {/* Cột 6: Trạng Thái Khảo Sát */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusConf.label}</span>
                        </span>
                        {parcel.surveyStatus === 'POSTPONED_ABSENT' && (parcel.absenceAttemptCount || 0) > 0 && (
                          <div className="text-[10px] text-purple-600 font-bold mt-0.5">
                            Đã lập biên bản: {parcel.absenceAttemptCount} lần
                          </div>
                        )}
                      </td>

                      {/* Cột 7: Thao Tác Quản Trị */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút CAD nếu là chung cư, hoặc chuyển đổi nếu là nhà riêng lẻ */}
                          {parcel.buildingType === 'CONDOMINIUM' ? (
                            <button
                              type="button"
                              onClick={() => setCadModalParcel(parcel)}
                              className="px-2 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shadow-2xs"
                              title="Quản lý mặt bằng CAD & chia cắt căn hộ (Zone Admin)"
                            >
                              <Layers size={13} className="text-teal-600" />
                              <span className="hidden xl:inline">CAD Tầng</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCondoConversionTarget(parcel)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                              title="Chuyển đổi thành Chung cư (CONDOMINIUM)"
                            >
                              <Building2 size={14} />
                            </button>
                          )}

                          {onNavigateToMap && (
                            <button
                              type="button"
                              onClick={() => onNavigateToMap(parcel)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                              title="Định vị trên Bản đồ số GIS"
                            >
                              <MapPin size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setReshapeModalParcel(parcel)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                            title="Nắn chỉnh đa giác ranh thửa đất khớp bờ tường/mái nhà vệ tinh"
                          >
                            <Move size={14} />
                          </button>

                          {onViewSurvey && (
                            <button
                              type="button"
                              onClick={() => onViewSurvey(parcel)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Xem hồ sơ / Thẩm định"
                            >
                              <FileText size={13} />
                              <span>Hồ sơ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Desktop Pagination Toolbar */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Hiển thị{' '}
              <strong className="text-slate-800">
                {sortedParcels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              -{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, sortedParcels.length)}
              </strong>{' '}
              trong tổng số <strong className="text-slate-800">{sortedParcels.length}</strong> thửa đất
              {sortedParcels.length !== parcels.length && (
                <span className="text-slate-400"> (từ {parcels.length} thửa gốc)</span>
              )}
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={25}>25 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </div>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1 self-center">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Trang đầu"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Trang trước"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-3 py-1 font-bold text-slate-700">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Trang sau"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
              title="Trang cuối"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Detail Quick Drawer Modal */}
      {inspectParcel && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setInspectParcel(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {inspectParcel.projectParcelCode}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {inspectParcel.houseNumber ? `${inspectParcel.houseNumber}, ` : ''}
                  {inspectParcel.street || 'Đoạn tuyến chính'}
                </h3>
                {(inspectParcel.ward || inspectParcel.district) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[inspectParcel.ward ? `Phường ${inspectParcel.ward}` : '', inspectParcel.district ? `Quận ${inspectParcel.district}` : ''].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectParcel(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Chủ hộ</span>
                <span className="font-bold text-slate-800">{inspectParcel.ownerName || 'Chưa cập nhật'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Điện thoại</span>
                <span className="font-mono font-bold text-slate-800">{inspectParcel.ownerPhone || '—'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Mã địa chính</span>
                <span className="font-mono font-bold text-slate-800">{inspectParcel.officialCadastralCode || '—'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Khảo sát viên</span>
                <span className="font-bold text-slate-800">{inspectParcel.assignedSurveyorName || 'Chưa phân công'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Diện tích đất / Sàn</span>
                <span className="font-bold text-slate-800 font-mono">
                  Đất: {inspectParcel.landArea || 0} m² • Sàn: {inspectParcel.constructionArea || 0} m²
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Số tầng / Loại hình</span>
                <span className="font-bold text-slate-800">
                  {inspectParcel.floorCount || 1} tầng • {inspectParcel.buildingType === 'CONDOMINIUM' ? 'Chung cư' : 'Nhà riêng lẻ'}
                </span>
              </div>
              <div className="col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Trạng thái khảo sát</span>
                  <span className="font-bold text-indigo-700">
                    {STATUS_CONFIG[inspectParcel.surveyStatus || 'NOT_SURVEYED']?.label || inspectParcel.surveyStatus}
                  </span>
                </div>
                {inspectParcel.activePhase1ReportId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                    Có hồ sơ Phase 1
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
              {inspectParcel.buildingType === 'CONDOMINIUM' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCadModalParcel(inspectParcel);
                    setInspectParcel(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-teal-200"
                  title="Quản lý bản vẽ CAD và phân chia căn hộ"
                >
                  <Layers size={14} className="text-teal-600" />
                  <span>Quản Lý CAD & Phân Căn</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCondoConversionTarget(inspectParcel);
                    setInspectParcel(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-blue-200"
                  title="Chuyển đổi thửa đất sang Chung cư"
                >
                  <Building2 size={14} className="text-blue-600" />
                  <span>Chuyển Sang Chung Cư</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setReshapeModalParcel(inspectParcel);
                  setInspectParcel(null);
                }}
                className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200"
              >
                <Move size={14} />
                <span>Nắn Chỉnh Đa Giác</span>
              </button>

              {onNavigateToMap && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToMap(inspectParcel);
                    setInspectParcel(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <MapPin size={14} />
                  <span>Xem trên Bản đồ GIS</span>
                </button>
              )}
              {onViewSurvey && (
                <button
                  type="button"
                  onClick={() => {
                    onViewSurvey(inspectParcel);
                    setInspectParcel(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Mở Hồ Sơ / Thẩm Định</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cadastral Boundary Reshape Modal */}
      {reshapeModalParcel && (
        <CadastralBoundaryReshapeModal
          isOpen={!!reshapeModalParcel}
          parcel={reshapeModalParcel}
          onClose={() => setReshapeModalParcel(null)}
          onSuccess={() => {
            fetchZoneParcels();
            if (onRefreshStats) onRefreshStats();
          }}
        />
      )}

      {/* Floor Plan CAD Management Modal (Zone Admin Desktop) */}
      {cadModalParcel && (
        <FloorPlanCadManagementModal
          parcel={cadModalParcel}
          onClose={() => setCadModalParcel(null)}
          onUnitsUpdated={() => {
            fetchZoneParcels();
            if (onRefreshStats) onRefreshStats();
          }}
          readOnly={false}
        />
      )}

      {/* Confirmation Modal: Convert Parcel to Condominium */}
      {condoConversionTarget && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chuyển Đổi Sang Chung Cư
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Mã thửa: {condoConversionTarget.projectParcelCode || condoConversionTarget.id}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn chuyển đổi thửa đất này thành <strong>Chung cư / Tòa nhà nhiều căn hộ (CONDOMINIUM)</strong>?
            </p>
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-bold">• Sau khi chuyển đổi:</p>
              <p>1. Loại hình công trình được cập nhật thành CONDOMINIUM.</p>
              <p>2. Màn hình quản lý CAD mặt bằng tầng sẽ mở ra để bạn tải bản vẽ kiến trúc và chia cắt các ô căn hộ con.</p>
              <p>3. Khảo sát viên sẽ được phân bổ khảo sát khối tháp dùng chung và các căn hộ con độc lập.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isConvertingCondo}
                onClick={() => setCondoConversionTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isConvertingCondo}
                onClick={() => handleConvertToCondo(condoConversionTarget)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isConvertingCondo ? (
                  <span>Đang xử lý...</span>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Xác Nhận Chuyển Đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
