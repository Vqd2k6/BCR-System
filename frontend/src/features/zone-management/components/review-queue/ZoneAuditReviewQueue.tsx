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
  ChevronRight,
  Layers,
  FileText,
  User,
  MapPin,
  ExternalLink,
  ArrowRightLeft,
  Split,
} from 'lucide-react';
import { Card } from '../../../../core/components/ui/Card';
import { Badge } from '../../../../core/components/ui/Badge';
import { Button } from '../../../../core/components/ui/Button';
import { api } from '../../../../services/api';
import { AuditStudioModal } from './AuditStudioModal';
import { RejectReportModal } from './RejectReportModal';
import { AdminReassignParcelModal } from './AdminReassignParcelModal';
import { AdminGisMutationModal } from './AdminGisMutationModal';

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
}

interface Props {
  selectedZone: string;
  onStatsNeedRefresh?: () => void;
}

type TabType = 'ALL' | 'RESIDENTIAL' | 'CONDO' | 'ABSENT' | 'CRITICAL' | 'REJECTED' | 'APPROVED';

export const ZoneAuditReviewQueue: React.FC<Props> = ({ selectedZone, onStatsNeedRefresh }) => {
  const [items, setItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Filtering states
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
  } | null>(null);

  const [mutationModalData, setMutationModalData] = useState<{
    parcelId: string;
    parcelCode: string;
    houseNumber?: string;
    street?: string;
    currentAreaM2?: number;
    reportId?: string;
  } | null>(null);

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
          limit: 100,
        },
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        setItems(res.data.data);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error('[ZoneAuditReviewQueue] Error loading submissions:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tải danh sách hồ sơ chờ duyệt.');
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

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Tab filter
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

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = item.project_parcel_code?.toLowerCase().includes(q);
        const streetMatch = `${item.house_number || ''} ${item.street || ''}`.toLowerCase().includes(q);
        const surveyorMatch = item.surveyor_name?.toLowerCase().includes(q);
        const zoneMatch = item.zone_id?.toLowerCase().includes(q);
        if (!codeMatch && !streetMatch && !surveyorMatch && !zoneMatch) return false;
      }

      return true;
    });
  }, [items, activeTab, searchQuery]);

  // Xem trước báo cáo kỹ thuật (HTML/PDF preview)
  const handlePreviewReport = (reportId: string | null) => {
    if (!reportId) {
      alert('Hồ sơ này chưa có báo cáo kỹ thuật hoàn chỉnh để xem trước.');
      return;
    }
    const previewUrl = `/api/v1/reports/${reportId}/preview/html`;
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

  // Helper render Burland Badge
  const renderBurlandBadge = (cat?: string | null, width?: number | null) => {
    if (!cat) return <span className="text-slate-400 font-mono text-[11px]">Chưa tính</span>;
    switch (cat) {
      case 'GRADE_0':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Cấp 0 (Không đáng kể)
          </span>
        );
      case 'GRADE_1':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Cấp 1 (Rất nhẹ {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_2':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Cấp 2 (Nhẹ {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_3':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            ⚠️ Cấp 3 (Trung bình {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_4':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
            🚨 Cấp 4 (Nặng {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_5':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-red-600 text-white border border-red-700 animate-pulse">
            💥 Cấp 5 (Rất nặng / Nguy cấp)
          </span>
        );
      default:
        return <span className="text-slate-600 text-[11px]">{cat}</span>;
    }
  };

  // Helper render Status Badge
  const renderStatusBadge = (item: PendingSubmissionItem) => {
    if (item.status === 'POSTPONED_ABSENT' || item.is_refused_or_absent) {
      return (
        <Badge variant="warning" dot className="font-bold">
          <UserX className="w-3 h-3 mr-0.5 inline" />
          Vắng chủ hộ (Lần {item.absence_attempt_count || 1})
        </Badge>
      );
    }
    if (item.status === 'REJECTED') {
      return (
        <Badge variant="danger" dot className="font-bold">
          <AlertTriangle className="w-3 h-3 mr-0.5 inline" />
          Đã trả về sửa
        </Badge>
      );
    }
    if (item.status === 'APPROVED') {
      return (
        <Badge variant="success" dot className="font-bold">
          <CheckCircle2 className="w-3 h-3 mr-0.5 inline" />
          Đã phê duyệt
        </Badge>
      );
    }
    return (
      <Badge variant="info" dot className="font-bold">
        <Clock className="w-3 h-3 mr-0.5 inline" />
        Chờ thẩm định
      </Badge>
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
      {/* Toast alert */}
      {toastMessage && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-emerald-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Hàng Đợi Thẩm Định & Phê Duyệt Hồ Sơ Hiện Trường
            </h2>
            <Badge variant="info" size="sm">
              {filteredItems.length} hồ sơ
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình kiểm soát chất lượng 2 lớp cho Trưởng Zone: Kiểm tra ảnh có thước đo tỷ lệ, đối soát hiện trạng nứt và cấp duyệt báo cáo BCS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm mã thửa, địa chỉ, KSV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={fetchSubmissions}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors shadow-xs"
            title="Làm mới hàng đợi"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-sky-600' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 border-b border-slate-100 flex items-center gap-2 overflow-x-auto bg-white py-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Tất cả chờ xử lý</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'ALL' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.all}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('RESIDENTIAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'RESIDENTIAL'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Nhà dân Phase 1</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'RESIDENTIAL' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.residential}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('CONDO')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'CONDO'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Chung cư con</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab === 'CONDO' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tabCounts.condo}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ABSENT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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
          onClick={() => setActiveTab('CRITICAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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
          onClick={() => setActiveTab('REJECTED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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
          onClick={() => setActiveTab('APPROVED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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

      {/* Content Table / Cards */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
            <tr>
              <th className="p-3.5">Mã Thửa / Công Trình</th>
              <th className="p-3.5">Địa chỉ & Loại CT</th>
              <th className="p-3.5">Khảo Sát Viên</th>
              <th className="p-3.5 text-center">Trạng Thái Hồ Sơ</th>
              <th className="p-3.5 text-center">Cấp Nguy Cơ (Burland)</th>
              <th className="p-3.5 text-center">Khuyết Tật</th>
              <th className="p-3.5 text-center">Cảnh Báo Kỹ Thuật</th>
              <th className="p-3.5 text-right">Thao Tác Thẩm Định</th>
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
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400">
                  <FileCheck2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <div className="text-sm font-bold text-slate-600">Không có hồ sơ nào trong hàng đợi</div>
                  <p className="text-xs text-slate-400 mt-1">
                    Tất cả hồ sơ trong phân khu {selectedZone === 'ALL' ? 'toàn tuyến' : selectedZone} đã được xử lý hoặc chưa có đợt gửi mới.
                  </p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isCriticalBurland = ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(
                  item.burland_damage_category || ''
                );
                const hasAlerts = Number(item.alert_count) > 0;

                return (
                  <tr
                    key={item.parcel_id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCriticalBurland ? 'bg-orange-50/30' : hasAlerts ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Mã Thửa */}
                    <td className="p-3.5">
                      <div className="font-mono font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{item.project_parcel_code}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Phân khu: <strong className="text-slate-700">{item.zone_id}</strong>
                      </div>
                    </td>

                    {/* Địa chỉ & Loại CT */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 max-w-[200px] truncate" title={`${item.house_number || ''} ${item.street || ''}`}>
                        {item.house_number ? `${item.house_number} ` : ''}
                        {item.street || 'Chưa cập nhật địa chỉ'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        {item.building_type?.includes('CONDO') ? (
                          <span className="text-purple-700 font-medium flex items-center gap-0.5">
                            <Building className="w-3 h-3" /> Chung cư
                          </span>
                        ) : (
                          <span className="text-slate-600 flex items-center gap-0.5">
                            <Home className="w-3 h-3" /> Nhà liền thổ
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Khảo Sát Viên */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.surveyor_name || 'Khảo sát viên'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.surveyor_code && <span>Mã: {item.surveyor_code}</span>}
                        {item.updated_at && (
                          <span className="ml-1 text-slate-400">
                            • {new Date(item.updated_at).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Trạng Thái Hồ Sơ */}
                    <td className="p-3.5 text-center">{renderStatusBadge(item)}</td>

                    {/* Cấp Nguy Cơ (Burland) */}
                    <td className="p-3.5 text-center">
                      {renderBurlandBadge(item.burland_damage_category, item.burland_max_crack_width_mm)}
                    </td>

                    {/* Khuyết Tật */}
                    <td className="p-3.5 text-center">
                      <span className="font-black text-slate-800 text-sm">
                        {item.defect_count || 0}
                      </span>
                      <span className="text-[11px] text-slate-500 block">vết nứt / D</span>
                    </td>

                    {/* Cảnh Báo Kỹ Thuật */}
                    <td className="p-3.5 text-center">
                      {Number(item.alert_count) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          {item.alert_count} cờ kiểm soát
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Chuẩn quy cách
                        </span>
                      )}
                    </td>

                    {/* Thao Tác Thẩm Định */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Nút Thao Tác Chính (Mở Studio 9 bước / Xem hồ sơ) */}
                        <button
                          disabled={!item.report_id}
                          onClick={() => handleOpenStudio(item.report_id)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs transition-colors ${
                            !item.report_id
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : item.status === 'APPROVED'
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer'
                              : item.status === 'REJECTED'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer'
                              : 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'
                          }`}
                          title={
                            !item.report_id
                              ? 'Chưa có báo cáo kỹ thuật'
                              : item.status === 'APPROVED'
                              ? 'Xem hồ sơ kỹ thuật đã phê duyệt'
                              : item.status === 'REJECTED'
                              ? 'Xem chi tiết hồ sơ bị trả về'
                              : 'Mở Studio thẩm định kỹ thuật toàn diện 9 bước'
                          }
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {item.status === 'APPROVED'
                              ? 'Xem hồ sơ 📄'
                              : item.status === 'REJECTED'
                              ? 'Xem lý do 🔍'
                              : 'Thẩm định 🔍'}
                          </span>
                        </button>

                        {/* Nút Xem Bản In Preview HTML/PDF */}
                        {item.report_id && (
                          <button
                            onClick={() => handlePreviewReport(item.report_id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                            title="Xem trước bản in Báo cáo A4 (Preview HTML)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Trả Về Nhanh (Chỉ hiện khi chưa duyệt) */}
                        {item.report_id && item.status !== 'APPROVED' && (
                          <button
                            onClick={() =>
                              setRejectModalData({
                                reportId: item.report_id!,
                                parcelCode: item.project_parcel_code,
                                surveyorName: item.surveyor_name || undefined,
                              })
                            }
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                            title="Yêu cầu khảo sát lại / Trả về điều chỉnh"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Điều Chuyển / Hoán Đổi Thửa (Khắc phục tích nhầm thửa liền kề) */}
                        {item.report_id && (
                          <button
                            onClick={() =>
                              setReassignModalData({
                                reportId: item.report_id!,
                                parcelCode: item.project_parcel_code,
                                parcelId: item.parcel_id,
                                houseNumber: item.house_number,
                                street: item.street,
                                surveyorName: item.surveyor_name || undefined,
                              })
                            }
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                            title="Điều chuyển hồ sơ sang thửa khác hoặc hoán đổi 2 nhà kề nhau bị tích chéo"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Tách / Gộp Thửa GIS Trực Tiếp */}
                        <button
                          onClick={() =>
                            setMutationModalData({
                              parcelId: item.parcel_id,
                              parcelCode: item.project_parcel_code,
                              houseNumber: item.house_number,
                              street: item.street,
                              reportId: item.report_id || undefined,
                            })
                          }
                          className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 transition-colors cursor-pointer"
                          title="Tách hoặc gộp thửa thực địa trên GIS (Zone Admin)"
                        >
                          <Split className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Quy tắc thẩm định:</span>
          <span>Bắt buộc có thước đo tỷ lệ nứt (Scale Card), ảnh GPS không lệch quá 300m, đối soát chữ ký chủ hộ.</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Hiển thị {filteredItems.length} / {items.length} hồ sơ
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
          onSuccess={() => {
            setRejectModalData(null);
            fetchSubmissions();
            if (onStatsNeedRefresh) onStatsNeedRefresh();
          }}
        />
      )}

      {/* Reassign / Swap Parcel Modal */}
      {reassignModalData && (
        <AdminReassignParcelModal
          isOpen={!!reassignModalData}
          reportId={reassignModalData.reportId}
          currentParcelCode={reassignModalData.parcelCode}
          currentParcelId={reassignModalData.parcelId}
          currentHouseNumber={reassignModalData.houseNumber}
          currentStreet={reassignModalData.street}
          surveyorName={reassignModalData.surveyorName}
          allReports={items}
          onClose={() => setReassignModalData(null)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* GIS Mutation Modal */}
      {mutationModalData && (
        <AdminGisMutationModal
          isOpen={!!mutationModalData}
          parcelId={mutationModalData.parcelId}
          parcelCode={mutationModalData.parcelCode}
          houseNumber={mutationModalData.houseNumber}
          street={mutationModalData.street}
          currentAreaM2={mutationModalData.currentAreaM2}
          reportId={mutationModalData.reportId}
          onClose={() => setMutationModalData(null)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}
    </Card>
  );
};
