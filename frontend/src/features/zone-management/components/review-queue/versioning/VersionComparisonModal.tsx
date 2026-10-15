import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Shield,
  FileText,
  Camera,
  Layers,
  Sparkles,
  GitBranch,
  ArrowRight,
  Lock,
  ChevronDown,
  Eye,
  Copy,
  Check,
  MapPin,
  Building,
  ChevronRight,
  FileCode,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export interface SurveyReportVersionItem {
  id: string;
  versionNumber: number;
  versionTag:
    | 'ORIGINAL_SUBMISSION'
    | 'ADMIN_DIFF_SAVE'
    | 'CHIEF_ENGINEER_OVERRIDE'
    | 'PHOTO_REPLACEMENT'
    | 'ROLLBACK_RESTORE'
    | 'REVERT_TO_DRAFT';
  title: string;
  editReason?: string;
  createdAt: string;
  createdByName?: string;
  createdByRole?: string;
  diffSummary?: any[];
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode?: string;
  reportCode?: string;
  currentData: any; // Full AuditStepwiseData
  onClose: () => void;
  onRollbackSuccess: () => void;
}

export const VersionComparisonModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  reportCode,
  currentData,
  onClose,
  onRollbackSuccess,
}) => {
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<SurveyReportVersionItem[]>([]);
  const [selectedVerNumber, setSelectedVerNumber] = useState<number | null>(null);

  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Dual-mode state: Diff vs Full Snapshot
  const [viewMode, setViewMode] = useState<'DIFF' | 'FULL_SNAPSHOT'>('DIFF');
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Rollback prompt state
  const [showRollbackPrompt, setShowRollbackPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState('');

  // 1. Fetch version list
  const fetchVersions = async () => {
    setLoadingVersions(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/admin/reports/${reportId}/versions`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const list: SurveyReportVersionItem[] = res.data.data;
        setVersions(list);
        if (list.length > 0) {
          // Default select the oldest version (v0) or second latest version to immediately compare
          const defaultVer = list.length > 1 ? list[1].versionNumber : list[0].versionNumber;
          setSelectedVerNumber(defaultVer);
        }
      }
    } catch (err: unknown) {
      console.error('[VersionComparisonModal] Error fetching versions:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể tải danh sách phiên bản.'));
    } finally {
      setLoadingVersions(false);
    }
  };

  // 2. Fetch specific snapshot when selectedVerNumber changes
  const fetchSnapshot = async (verNum: number) => {
    setLoadingSnapshot(true);
    try {
      const res = await api.get(`/admin/reports/${reportId}/versions/${verNum}`);
      if (res.data?.success && res.data?.data) {
        setSelectedSnapshot(res.data.data);
      }
    } catch (err: unknown) {
      console.error('[VersionComparisonModal] Error fetching snapshot:', err);
      setErrorMsg(getErrorMessage(err, `Không thể tải bản chụp phiên bản v${verNum}`));
    } finally {
      setLoadingSnapshot(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      fetchVersions();
    } else {
      setVersions([]);
      setSelectedVerNumber(null);
      setSelectedSnapshot(null);
      setErrorMsg('');
      setViewMode('DIFF');
      setShowRawJson(false);
      setCopiedJson(false);
      setShowRollbackPrompt(false);
      setAdminPassword('');
      setRollbackReason('');
    }
  }, [isOpen, reportId]);

  useEffect(() => {
    if (selectedVerNumber !== null && isOpen) {
      fetchSnapshot(selectedVerNumber);
    }
  }, [selectedVerNumber]);

  if (!isOpen) return null;

  // Selected version item
  const selectedVerItem = versions.find((v) => v.versionNumber === selectedVerNumber);
  const latestVersionNumber = versions.length > 0 ? versions[0].versionNumber : 0;
  const isSelectedCurrent = selectedVerNumber === latestVersionNumber;

  // Helper badge for tag
  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'ORIGINAL_SUBMISSION':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-200">
            Nộp Gốc (KSV)
          </span>
        );
      case 'ADMIN_DIFF_SAVE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-200">
            Zone Admin Sửa
          </span>
        );
      case 'CHIEF_ENGINEER_OVERRIDE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-200">
            Phán Quyết KST
          </span>
        );
      case 'PHOTO_REPLACEMENT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-700 border border-blue-200">
            Thay Ảnh
          </span>
        );
      case 'ROLLBACK_RESTORE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-700 border border-rose-200">
            Khôi Phục (Rollback)
          </span>
        );
      case 'REVERT_TO_DRAFT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/10 text-orange-700 border border-orange-200">
            Chuyển Làm Dở
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {tag}
          </span>
        );
    }
  };

  // Extract comparable data from snapshot & currentData
  const snapData = selectedSnapshot?.snapshotData || {};
  const snapLeft = snapData.leftPane || {};
  const snapRight = snapData.rightPane || {};
  const snapJson = snapData.surveyJson || {};

  const curLeft = currentData?.leftPane || {};
  const curRight = currentData?.rightPane || {};
  const curJson = currentData?.surveyJson || {};

  // Extraction helpers
  const getParcelVal = (pane: any, field: string) => pane?.parcel?.[field] ?? pane?.[field] ?? '---';
  const getSpecVal = (pane: any, field: string) => pane?.specs?.[field] ?? '---';

  const handleExecuteRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword || !adminPassword.trim()) {
      setRollbackError('Vui lòng nhập mật khẩu tài khoản quản trị để xác thực.');
      return;
    }
    if (!rollbackReason || rollbackReason.trim().length < 5) {
      setRollbackError('Lý do hoàn nguyên bắt buộc phải từ 5 ký tự trở lên.');
      return;
    }

    setIsRollingBack(true);
    setRollbackError('');
    try {
      const res = await api.post(`/admin/reports/${reportId}/versions/${selectedVerNumber}/rollback`, {
        adminPassword: adminPassword.trim(),
        rollbackReason: rollbackReason.trim(),
      });

      if (res.data?.success) {
        setShowRollbackPrompt(false);
        onRollbackSuccess();
        onClose();
      } else {
        setRollbackError(res.data?.message || 'Không thể thực hiện khôi phục phiên bản.');
      }
    } catch (err: unknown) {
      console.error('[handleExecuteRollback] Error:', err);
      setRollbackError(getErrorMessage(err, 'Lỗi kết nối khi hoàn nguyên phiên bản.'));
    } finally {
      setIsRollingBack(false);
    }
  };

  // Helper row renderer with diff comparison
  const renderCompareRow = (label: string, oldVal: any, newVal: any) => {
    const isDifferent = String(oldVal ?? '').trim() !== String(newVal ?? '').trim();
    return (
      <div
        className={`py-2 px-3 rounded-lg border text-xs grid grid-cols-2 gap-4 transition-colors ${
          isDifferent
            ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-medium'
            : 'bg-white border-slate-100 text-slate-700'
        }`}
      >
        <div className="flex items-start justify-between pr-2 border-r border-slate-200/60">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className="font-semibold text-right break-words">{String(oldVal ?? '---')}</span>
        </div>
        <div className="flex items-start justify-between pl-2">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className={`font-semibold text-right break-words ${isDifferent ? 'text-amber-800' : ''}`}>
            {String(newVal ?? '---')}
            {isDifferent && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                Khác biệt
              </span>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Helper row renderer for full snapshot inspection
  const renderSnapshotField = (label: string, val: any, badge?: string) => (
    <div className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-start justify-between gap-2">
      <span className="text-slate-400 font-normal shrink-0">{label}:</span>
      <div className="flex items-center gap-1.5 text-right font-semibold text-slate-200">
        <span className="break-words">{String(val ?? '---')}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl h-[92vh] overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  So Sánh Phiên Bản & Hoàn Nguyên Thời Gian
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Time-Travel Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Thửa đất: <strong className="text-white">{parcelCode || '---'}</strong> • Mã báo cáo:{' '}
                <strong className="text-slate-300">{reportCode || '---'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Rollback Trigger Button */}
            {!isSelectedCurrent && selectedVerNumber !== null && (
              <button
                type="button"
                onClick={() => {
                  setRollbackError('');
                  setShowRollbackPrompt(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi Phục Về v{selectedVerNumber}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Version Picker Carousel & Dual-Mode Tabs */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              Phiên bản:
            </span>

            <div className="flex items-center gap-2">
              {versions.map((v) => {
                const isSelected = v.versionNumber === selectedVerNumber;
                const isCurrent = v.versionNumber === latestVersionNumber;
                return (
                  <button
                    key={v.id || v.versionNumber}
                    type="button"
                    onClick={() => setSelectedVerNumber(v.versionNumber)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="font-mono font-bold">v{v.versionNumber}</span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                        Hiện tại
                      </span>
                    )}
                    <span className="text-[11px] opacity-80 truncate max-w-[130px]">{v.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual-Mode Tabs */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('DIFF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'DIFF'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Đối Soát Sai Khác (Diff)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FULL_SNAPSHOT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'FULL_SNAPSHOT'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Bản Xem Đầy Đủ (Full Snapshot)</span>
            </button>
          </div>
        </div>

        {/* Version Metadata Banner */}
        {selectedVerItem && (
          <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-indigo-300">
                Phiên bản v{selectedVerItem.versionNumber}: {selectedVerItem.title}
              </span>
              {getTagBadge(selectedVerItem.versionTag)}
              {selectedVerItem.editReason && (
                <span className="text-slate-400 italic">Lý do: &ldquo;{selectedVerItem.editReason}&rdquo;</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {selectedVerItem.createdByName || 'Hệ thống'} ({selectedVerItem.createdByRole || 'ADMIN'})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date(selectedVerItem.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        )}

        {/* Comparison Workspace (Diff or Full Snapshot) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/30">
          {loadingSnapshot ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Đang tải dữ liệu bản chụp phiên bản v{selectedVerNumber}...</span>
            </div>
          ) : viewMode === 'DIFF' ? (
            <>
              {/* Header titles for 2 columns */}
              <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-900/90 text-xs font-bold text-slate-300 shrink-0">
                <div className="p-3 border-r border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>Dữ Liệu Bản Chụp: Phiên Bản v{selectedVerNumber}</span>
                  </div>
                  {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                </div>
                <div className="p-3 flex items-center justify-between bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Dữ Liệu Hiện Tại: Phiên Bản v{latestVersionNumber} (Active)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Đang áp dụng
                  </span>
                </div>
              </div>

              {/* Scrollable comparison lists */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Section 1: Thửa đất & Chủ hộ */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>1. Thông Tin Định Danh & Thửa Đất</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Số nhà', getParcelVal(snapLeft, 'houseNumber'), getParcelVal(curLeft, 'houseNumber'))}
                    {renderCompareRow('Đường / Phố', getParcelVal(snapLeft, 'street'), getParcelVal(curLeft, 'street'))}
                    {renderCompareRow('Phường / Xã', getParcelVal(snapLeft, 'ward'), getParcelVal(curLeft, 'ward'))}
                    {renderCompareRow('Quận / Huyện', getParcelVal(snapLeft, 'district'), getParcelVal(curLeft, 'district'))}
                    {renderCompareRow('Chủ hộ', getParcelVal(snapLeft, 'ownerName'), getParcelVal(curLeft, 'ownerName'))}
                    {renderCompareRow('SĐT chủ hộ', getParcelVal(snapLeft, 'ownerPhone'), getParcelVal(curLeft, 'ownerPhone'))}
                    {renderCompareRow('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode'), getParcelVal(curLeft, 'officialCadastralCode'))}
                    {renderCompareRow('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2'), getParcelVal(curLeft, 'landAreaM2'))}
                    {renderCompareRow('Diện tích XD (m²)', getParcelVal(snapLeft, 'constructionAreaM2'), getParcelVal(curLeft, 'constructionAreaM2'))}
                    {renderCompareRow('Chiều rộng mặt tiền (m)', getParcelVal(snapLeft, 'frontageWidth'), getParcelVal(curLeft, 'frontageWidth'))}
                    {renderCompareRow('Chiều sâu thửa đất (m)', getParcelVal(snapLeft, 'lotDepth'), getParcelVal(curLeft, 'lotDepth'))}
                  </div>
                </div>

                {/* Section 2: Thông số kỹ thuật & Kết cấu */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>2. Thông Số Kỹ Thuật & Kết Cấu Công Trình</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Số tầng nổi', getSpecVal(snapLeft, 'floorCount'), getSpecVal(curLeft, 'floorCount'))}
                    {renderCompareRow('Số tầng ngầm/hầm', getSpecVal(snapLeft, 'basementCount'), getSpecVal(curLeft, 'basementCount'))}
                    {renderCompareRow('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction'), getSpecVal(curLeft, 'yearOfConstruction'))}
                    {renderCompareRow('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated')), String(getSpecVal(curLeft, 'isYearEstimated')))}
                    {renderCompareRow('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction'), getSpecVal(curLeft, 'landUseFunction'))}
                    {renderCompareRow('Phân loại cấp móng (CAT)', snapLeft?.specs?.foundationCatScore ?? '---', curLeft?.specs?.foundationCatScore ?? '---')}
                    {renderCompareRow('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM'), getSpecVal(curLeft, 'foundationDepthM'))}
                    {renderCompareRow('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM'), getSpecVal(curLeft, 'foundationSpacingM'))}
                    {renderCompareRow('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes'), getSpecVal(curLeft, 'foundationNotes'))}
                  </div>
                </div>

                {/* Section 3: Bảng điểm rủi ro & Phán quyết Kỹ sư trưởng */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>3. Bảng Điểm Rủi Ro (ECS / VI / BRA) & Can Thiệp Chuyên Môn</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Hạng nứt Burland (E1)',
                      snapRight?.riskCard?.e1_burland_score ?? '---',
                      curRight?.riskCard?.e1_burland_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Khuyết tật kết cấu (E2)',
                      snapRight?.riskCard?.e2_structure_score ?? '---',
                      curRight?.riskCard?.e2_structure_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Biến dạng lún nghiêng (E3)',
                      snapRight?.riskCard?.e3_deformation_score ?? '---',
                      curRight?.riskCard?.e3_deformation_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Tổng điểm ECS',
                      snapRight?.riskCard?.total_ecs_score ?? '---',
                      curRight?.riskCard?.total_ecs_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Xếp hạng ECS',
                      snapRight?.riskCard?.ecs_class ?? '---',
                      curRight?.riskCard?.ecs_class ?? '---'
                    )}
                    {renderCompareRow(
                      'Điểm tổn thương VI trung bình',
                      snapRight?.riskCard?.avg_vi_score ?? '---',
                      curRight?.riskCard?.avg_vi_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Xếp hạng VI',
                      snapRight?.riskCard?.vi_class ?? '---',
                      curRight?.riskCard?.vi_class ?? '---'
                    )}
                    {renderCompareRow(
                      'Đánh giá rủi ro chung (BRA)',
                      snapRight?.riskCard?.bra ?? '---',
                      curRight?.riskCard?.bra ?? '---'
                    )}
                    {renderCompareRow(
                      'Áp dụng phán quyết KST',
                      String(snapRight?.riskCard?.is_engineering_judgement_applied ?? false),
                      String(curRight?.riskCard?.is_engineering_judgement_applied ?? false)
                    )}
                    {renderCompareRow(
                      'Hành động phán quyết KST',
                      snapRight?.riskCard?.engineering_judgement_action ?? '---',
                      curRight?.riskCard?.engineering_judgement_action ?? '---'
                    )}
                    {renderCompareRow(
                      'Lý do phán quyết KST',
                      snapRight?.riskCard?.engineering_judgement_reason ?? '---',
                      curRight?.riskCard?.engineering_judgement_reason ?? '---'
                    )}
                  </div>
                </div>

                {/* Section 4: Chữ ký & Ý kiến hiện trường */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    <span>4. Xác Nhận Chữ Ký & Ý Kiến Hiện Trường</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Họ tên Khảo sát viên',
                      snapJson?.signatures?.surveyorName || snapData?.surveyorName,
                      curJson?.signatures?.surveyorName || currentData?.surveyorName
                    )}
                    {renderCompareRow(
                      'Chữ ký Khảo sát viên',
                      snapData?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có'
                    )}
                    {renderCompareRow(
                      'Chữ ký Chủ nhà / Đại diện',
                      snapData?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có'
                    )}
                    {renderCompareRow(
                      'Ý kiến của chủ hộ',
                      snapJson?.signatures?.ownerFeedback || snapData?.ownerRemarks,
                      curJson?.signatures?.ownerFeedback || currentData?.ownerRemarks
                    )}
                    {renderCompareRow(
                      'Khuyến nghị kỹ thuật',
                      snapData?.engineeringRecommendations || snapLeft?.conclusions?.recommendations,
                      currentData?.engineeringRecommendations || curLeft?.conclusions?.recommendations
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Full Snapshot View */
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Full Snapshot Info Callout */}
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        Bản Chụp Toàn Diện Hiện Trạng: Phiên Bản v{selectedVerNumber}
                      </h4>
                      {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Lưu vết bất biến lúc {selectedVerItem?.createdAt ? new Date(selectedVerItem.createdAt).toLocaleString('vi-VN') : '---'} bởi{' '}
                      <strong className="text-white">{selectedVerItem?.createdByName || 'Hệ thống'}</strong>
                      {selectedVerItem?.editReason && (
                        <span> — Lý do: &ldquo;{selectedVerItem.editReason}&rdquo;</span>
                      )}
                    </p>
                  </div>
                </div>
                {!isSelectedCurrent && selectedVerNumber !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setRollbackError('');
                      setShowRollbackPrompt(true);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi Phục Theo Bản Chụp v{selectedVerNumber}</span>
                  </button>
                )}
              </div>

              {/* Section 1: Thông tin Thửa đất & Chủ sở hữu */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>1. Thông Tin Định Danh & Thửa Đất</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Số nhà', getParcelVal(snapLeft, 'houseNumber'))}
                  {renderSnapshotField('Đường / Phố', getParcelVal(snapLeft, 'street'))}
                  {renderSnapshotField('Phường / Xã', getParcelVal(snapLeft, 'ward'))}
                  {renderSnapshotField('Quận / Huyện', getParcelVal(snapLeft, 'district'))}
                  {renderSnapshotField('Tên chủ hộ', getParcelVal(snapLeft, 'ownerName'))}
                  {renderSnapshotField('Số điện thoại', getParcelVal(snapLeft, 'ownerPhone'))}
                  {renderSnapshotField('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode'))}
                  {renderSnapshotField('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2'))}
                  {renderSnapshotField('Diện tích XD (m²)', getParcelVal(snapLeft, 'constructionAreaM2'))}
                  {renderSnapshotField('Chiều rộng MT (m)', getParcelVal(snapLeft, 'frontageWidth'))}
                  {renderSnapshotField('Chiều sâu thửa (m)', getParcelVal(snapLeft, 'lotDepth'))}
                </div>
              </div>

              {/* Section 2: Thông số kỹ thuật & Móng */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>2. Thông Số Kỹ Thuật, Móng & Bản Vẽ Hoàn Công</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Số tầng nổi', getSpecVal(snapLeft, 'floorCount'))}
                  {renderSnapshotField('Số tầng hầm', getSpecVal(snapLeft, 'basementCount'))}
                  {renderSnapshotField('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction'))}
                  {renderSnapshotField('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated')))}
                  {renderSnapshotField('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction'))}
                  {renderSnapshotField(
                    'Cấp móng (CAT)',
                    snapLeft?.specs?.foundationCatScore ?? snapData?.foundationCatScore ?? '---',
                    snapLeft?.specs?.foundationCatScore ? `CAT ${snapLeft.specs.foundationCatScore}` : undefined
                  )}
                  {renderSnapshotField('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM'))}
                  {renderSnapshotField('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM'))}
                  {renderSnapshotField('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes'))}
                </div>

                {/* As-Built Drawings */}
                {snapData?.asBuiltDrawings && snapData.asBuiltDrawings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-300 block mb-2">
                      Bản vẽ hoàn công đính kèm ({snapData.asBuiltDrawings.length}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {snapData.asBuiltDrawings.map((drawing: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 rounded-lg p-2 border border-slate-800">
                          {drawing.photoUrl ? (
                            <img
                              src={drawing.photoUrl}
                              alt={drawing.title || `Bản vẽ ${idx + 1}`}
                              className="w-full h-24 object-cover rounded mb-1"
                            />
                          ) : (
                            <div className="w-full h-24 bg-slate-900 rounded flex items-center justify-center text-slate-600 mb-1">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                          <p className="text-[11px] font-medium text-slate-300 truncate">
                            {drawing.title || `Bản vẽ ${idx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Mặt bằng các tầng & Vùng hư hại / Ghim CAD */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span>3. Mặt Bằng Các Tầng, Vùng Hư Hại & Ghim CAD</span>
                </h3>
                {(() => {
                  const floors = snapRight?.floors || snapData?.floors || snapJson?.floors || [];
                  if (!Array.isArray(floors) || floors.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 italic py-2">
                        Không có dữ liệu mặt bằng tầng trong bản chụp này.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {floors.map((floor: any, fIdx: number) => {
                        const zones = floor.damageZones || floor.zones || [];
                        return (
                          <div key={fIdx} className="bg-slate-950/70 rounded-xl border border-slate-800 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="text-xs font-bold text-white flex items-center gap-2">
                                <Building className="w-4 h-4 text-indigo-400" />
                                <span>{floor.floorName || `Tầng ${floor.floorNumber ?? fIdx + 1}`}</span>
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {zones.length} Vùng hư hại (Z)
                              </span>
                            </div>

                            {zones.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">Không có vùng hư hại trên tầng này.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {zones.map((zone: any, zIdx: number) => {
                                  const defects = zone.defects || zone.defectItems || [];
                                  return (
                                    <div key={zIdx} className="bg-slate-900 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-300">
                                          {zone.zoneCode || `Z${zIdx + 1}`}: {zone.zoneName || 'Vùng hư hại'}
                                        </span>
                                        {zone.cadPins && (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            📍 X: {zone.cadPins.xPercent ?? zone.cadPins.x ?? 0}%, Y: {zone.cadPins.yPercent ?? zone.cadPins.y ?? 0}%
                                          </span>
                                        )}
                                      </div>
                                      {defects.length > 0 && (
                                        <div className="text-[11px] text-slate-300 space-y-0.5">
                                          {defects.map((def: any, dIdx: number) => (
                                            <div key={dIdx} className="flex items-center gap-1.5 text-slate-300">
                                              <span className="text-amber-400 font-bold">•</span>
                                              <span className="font-mono text-indigo-300">{def.defectCode || `D${dIdx + 1}`}:</span>
                                              <span>{def.defectType || def.description || 'Khuyết tật'}</span>
                                              {def.severity && (
                                                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                  Cấp {def.severity}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Section 4: Bảng điểm rủi ro (ECS / VI / BRA) */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>4. Đánh Giá Rủi Ro (ECS / VI / BRA) & Phán Quyết Chuyên Môn</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {renderSnapshotField('E1 - Hạng nứt Burland', snapRight?.riskCard?.e1_burland_score ?? '---')}
                  {renderSnapshotField('E2 - Khuyết tật kết cấu', snapRight?.riskCard?.e2_structure_score ?? '---')}
                  {renderSnapshotField('E3 - Biến dạng lún nghiêng', snapRight?.riskCard?.e3_deformation_score ?? '---')}
                  {renderSnapshotField('E4 - Hiện trạng vật liệu', snapRight?.riskCard?.e4_material_score ?? '---')}
                  {renderSnapshotField('E5 - Lịch sử công trình', snapRight?.riskCard?.e5_history_score ?? '---')}
                  {renderSnapshotField('E6 - Công năng & Môi trường', snapRight?.riskCard?.e6_overall_function_score ?? '---')}
                  {renderSnapshotField(
                    'Tổng điểm ECS',
                    snapRight?.riskCard?.total_ecs_score ?? '---',
                    snapRight?.riskCard?.ecs_class ? `Hạng ${snapRight.riskCard.ecs_class}` : undefined
                  )}
                  {renderSnapshotField(
                    'Điểm tổn thương VI trung bình',
                    snapRight?.riskCard?.avg_vi_score ?? '---',
                    snapRight?.riskCard?.vi_class ? `Hạng ${snapRight.riskCard.vi_class}` : undefined
                  )}
                  {renderSnapshotField('Đánh giá rủi ro chung (BRA)', snapRight?.riskCard?.bra ?? '---', snapRight?.riskCard?.bra)}
                  {renderSnapshotField('Cấp độ tác động thi công (I)', snapRight?.riskCard?.construction_impact_level_i ?? '---')}
                  {renderSnapshotField('Phán quyết KST áp dụng', String(snapRight?.riskCard?.is_engineering_judgement_applied ?? false))}
                  {renderSnapshotField('Hành động phán quyết', snapRight?.riskCard?.engineering_judgement_action ?? '---')}
                </div>
                {snapRight?.riskCard?.is_engineering_judgement_applied && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs space-y-1">
                    <span className="font-bold text-purple-300">Lý do can thiệp chuyên gia:</span>
                    <p className="text-slate-300 italic">{snapRight?.riskCard?.engineering_judgement_reason || 'Không có lý do chi tiết'}</p>
                  </div>
                )}
              </div>

              {/* Section 5: Hồ sơ ảnh & Biên bản */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>5. Hồ Sơ Ảnh Hiện Trường (P-01..P-04) & Chữ Ký Biên Bản</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {renderSnapshotField('Họ tên Khảo sát viên', snapJson?.signatures?.surveyorName || snapData?.surveyorName)}
                  {renderSnapshotField('Chữ ký KSV', snapData?.surveyorSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Chữ ký Chủ nhà / Đại diện', snapData?.ownerSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Ý kiến của chủ hộ', snapJson?.signatures?.ownerFeedback || snapData?.ownerRemarks)}
                  {renderSnapshotField('Khuyến nghị kỹ thuật', snapData?.engineeringRecommendations || snapLeft?.conclusions?.recommendations)}
                </div>
              </div>

              {/* Section 6: Bản Chụp Dữ Liệu JSON (Raw Snapshot) */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span>6. Bản Chụp Dữ Liệu Gốc (Raw Snapshot JSON)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(snapData, null, 2));
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedJson ? 'Đã sao chép!' : 'Sao chép JSON'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRawJson ? 'rotate-180' : ''}`} />
                      <span>{showRawJson ? 'Thu gọn' : 'Xem chi tiết JSON'}</span>
                    </button>
                  </div>
                </div>

                {showRawJson && (
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto overflow-x-auto whitespace-pre">
                    {JSON.stringify(snapData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>
              Cơ chế bất biến (Immutable Append-Only): Mọi hành động hoàn nguyên đều tạo phiên bản mới v
              {latestVersionNumber + 1} và bảo toàn 100% lịch sử kiểm toán.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>

      {/* Rollback Confirmation Sub-dialog */}
      {showRollbackPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Xác Nhận Khôi Phục Về Phiên Bản v{selectedVerNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Dữ liệu đang hoạt động của hồ sơ sẽ được hoàn nguyên về trạng thái của Phiên bản v
                  {selectedVerNumber}. Hành động này sẽ tạo thêm Phiên bản mới{' '}
                  <strong className="text-indigo-400">v{latestVersionNumber + 1}</strong> để lưu vết và giữ nguyên toàn bộ lịch sử trước đó.
                </p>
              </div>
            </div>

            {rollbackError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rollbackError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteRollback} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lý do kỹ thuật hoàn nguyên <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Ví dụ: Hoàn nguyên lại số liệu kết cấu ban đầu do admin trước tính sai tải trọng cải tạo..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật khẩu tài khoản Quản trị viên <span className="text-rose-400">*</span>:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tài khoản đăng nhập của bạn..."
                    required
                    className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => setShowRollbackPrompt(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isRollingBack ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang khôi phục...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xác nhận hoàn nguyên</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
