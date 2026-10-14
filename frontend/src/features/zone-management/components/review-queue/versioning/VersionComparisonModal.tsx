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

        {/* Toolbar: Version Picker Carousel */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 overflow-x-auto shrink-0">
          <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            Chọn phiên bản so sánh:
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

        {/* Comparison Workspace (2 Columns) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/30">
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
            {loadingSnapshot ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải dữ liệu bản chụp phiên bản v{selectedVerNumber}...</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
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
