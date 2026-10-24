import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  History,
  RotateCcw,
  Maximize2,
  Minimize2,
  Save,
  Undo2,
  GitBranch,
  ChevronDown,
  MapPin,
  Loader2,
} from 'lucide-react';
import { evaluateAddressStandard } from './stepwise/utils/residentialAddressStandards';
import { api } from '../../../../services/api';
import { VersionComparisonModal, type SurveyReportVersionItem } from './versioning/VersionComparisonModal';
import { RejectReportModal } from './RejectReportModal';
import { EngineeringJudgementModal } from './EngineeringJudgementModal';
import { ImageZoomModal } from '../../../../components/common/ImageZoomModal';
import { AuditStepwiseDocumentView } from './stepwise/AuditStepwiseDocumentView';
import { CondoUnitAuditStudioView } from './condo/CondoUnitAuditStudioView';
import { CondoMasterAreaAuditStudioView } from './condo/CondoMasterAreaAuditStudioView';
import { CondoMasterAuditStudioView } from './condo/CondoMasterAuditStudioView';
import { AuditDiffConfirmModal } from './AuditDiffConfirmModal';
import { AuditPhotoReplaceModal } from './AuditPhotoReplaceModal';
import { AuditPhotoActionModal, type PhotoActionPayload } from './AuditPhotoActionModal';
import { AuditHistoryModal } from './AuditHistoryModal';
import { AuditPhotoHistoryModal } from './AuditPhotoHistoryModal';
import type { AuditStepwiseData, DiffItem, AuditPhotoActionParams, AuditPhotoHistoryParams } from './stepwise/types';
import { isCadastralOwnerPlaceholder } from '../../../survey-phase1/utils/stepValidator';

interface Props {
  isOpen: boolean;
  reportId: string;
  onClose: () => void;
  onRefreshList: () => void;
}

export const AuditStudioModal: React.FC<Props> = ({
  isOpen,
  reportId,
  onClose,
  onRefreshList,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditStepwiseData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showJudgementModal, setShowJudgementModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Diff Confirmation Modal State
  const [diffModalData, setDiffModalData] = useState<{
    isOpen: boolean;
    diffItems: DiffItem[];
    updates: Record<string, unknown>;
  }>({ isOpen: false, diffItems: [], updates: {} });

  // Photo Replace Modal State (With 6-digit random code)
  const [photoReplaceData, setPhotoReplaceData] = useState<{
    isOpen: boolean;
    targetPhotoType: string;
    targetPhotoId?: string;
    defectId?: string;
    zoneId?: string;
    photoIndex?: number;
    currentPhotoUrl: string;
    photoTitle?: string;
  }>({ isOpen: false, targetPhotoType: 'OTHER', currentPhotoUrl: '' });

  // Photo Action Modal State (Replace / Add / Delete with M2 naming, metadata & lifecycle)
  const [photoActionData, setPhotoActionData] = useState<AuditPhotoActionParams & { isOpen: boolean }>({
    isOpen: false,
    category: 'IDENTIFICATION',
    targetPhotoType: 'OTHER',
  });

  // Staged Photo Actions to commit alongside text diffs
  const [stagedPhotoActions, setStagedPhotoActions] = useState<PhotoActionPayload[]>([]);
  const [stagedPhotoDiffs, setStagedPhotoDiffs] = useState<DiffItem[]>([]);

  // Photo History Lineage Modal State
  const [photoHistoryData, setPhotoHistoryData] = useState<AuditPhotoHistoryParams & { isOpen: boolean }>({
    isOpen: false,
  });

  // Audit History Modal State
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  // Versioning & Time Travel Modal State
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [versions, setVersions] = useState<SurveyReportVersionItem[]>([]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  // Fullscreen studio workspace mode (Default true)
  const [isFullscreen, setIsFullscreen] = useState(true);
  // Warning Flags Popover State
  const [showFlagsPopover, setShowFlagsPopover] = useState(false);

  // Pending Dirty Data Tracker from Document Views (chỉ các trường input/select form)
  const [pendingDirtyData, setPendingDirtyData] = useState<{
    dirtyCount: number;
    diffItems: DiffItem[];
    updates: Record<string, unknown>;
    discardAll: (silent?: boolean) => void;
    discardDiffItem?: (fieldKey: string) => void;
  }>({
    dirtyCount: 0,
    diffItems: [],
    updates: {},
    discardAll: () => { },
    discardDiffItem: () => { },
  });

  // Tổng số thay đổi chuẩn hóa (Diffs Form + Thao tác Ảnh)
  const totalDiffCount = (pendingDirtyData.dirtyCount || 0) + stagedPhotoActions.length;

  // Modal cảnh báo khi bấm Phê duyệt mà còn thay đổi chưa lưu
  const [showUnsavedChangesWarning, setShowUnsavedChangesWarning] = useState(false);

  // Kiểm toán hướng ảnh Nhà Dân Thường (Photo Orientation Audit)
  const [orientationAudit, setOrientationAudit] = useState<{
    hasMismatched: boolean;
    hasStrictViolations: boolean;
    mismatchedCount: number;
    violations: Array<{
      key: string;
      photoCode?: string;
      title: string;
      photoUrl: string;
      stepId: string;
      domElementId: string;
      currentOrientation: string;
      expectedOrientation: string;
      effectiveRotation: number;
      suggestedRotation?: number;
      isStrict: boolean;
      message: string;
    }>;
    stagedPhotoRotations: Record<string, number>;
    rotatePhoto?: (photoKey: string, rotationDeg: number, photoUrl?: string) => void;
  }>({
    hasMismatched: false,
    hasStrictViolations: false,
    mismatchedCount: 0,
    violations: [],
    stagedPhotoRotations: {},
  });
  const [showOrientationWarning, setShowOrientationWarning] = useState(false);
  const [showAddressWarning, setShowAddressWarning] = useState(false);
  const [showJudgementNotesModal, setShowJudgementNotesModal] = useState(false);
  const [judgementNotesInput, setJudgementNotesInput] = useState('');
  const [judgementNotesError, setJudgementNotesError] = useState('');
  const [selectedPhotoRotation, setSelectedPhotoRotation] = useState<number>(0);
  const [selectedPhotoCode, setSelectedPhotoCode] = useState<string>('');

  // Đánh giá chuẩn hóa thông tin địa chỉ thửa đất theo NQ 1685
  const currentAddressEval = React.useMemo(() => {
    if (!data) return null;
    const sJson = data.surveyJson || data.survey_data_json || {};
    const rawHn = pendingDirtyData.updates.houseNumber !== undefined
      ? String(pendingDirtyData.updates.houseNumber)
      : (typeof sJson.houseNumber === 'string' ? sJson.houseNumber : typeof data.houseNumber === 'string' ? data.houseNumber : undefined);
    const rawStreet = pendingDirtyData.updates.street !== undefined
      ? String(pendingDirtyData.updates.street)
      : (typeof sJson.street === 'string' ? sJson.street : typeof data.street === 'string' ? data.street : undefined);
    const rawWard = pendingDirtyData.updates.ward !== undefined
      ? String(pendingDirtyData.updates.ward)
      : (typeof sJson.ward === 'string' ? sJson.ward : typeof data.ward === 'string' ? data.ward : undefined);
    const rawDistrict = pendingDirtyData.updates.district !== undefined
      ? String(pendingDirtyData.updates.district)
      : (typeof sJson.district === 'string' ? sJson.district : typeof data.district === 'string' ? data.district : undefined);
    const zoneId = data.zoneId || data.zone_id || (typeof sJson.zoneId === 'string' ? sJson.zoneId : undefined);

    return evaluateAddressStandard(rawHn, rawStreet, rawWard, rawDistrict, zoneId);
  }, [data, pendingDirtyData.updates]);

  const fetchAuditData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/admin/reports/${reportId}/audit-view`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        setErrorMsg('Không thể tải dữ liệu hồ sơ.');
      }
    } catch (err: unknown) {
      console.error('[AuditStudioModal] Failed to fetch audit view:', err);
      setErrorMsg(getErrorMessage(err, 'Lỗi kết nối khi tải hồ sơ.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await api.get(`/admin/reports/${reportId}/versions`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setVersions(res.data.data);
      }
    } catch (err) {
      console.error('[AuditStudioModal] Failed to fetch versions:', err);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      fetchAuditData();
      fetchVersions();
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  // Thực thi phê duyệt hồ sơ trực tiếp (hỗ trợ truyền giải trình chuyên môn judgementNotes)
  const executeApprove = async (notes?: string) => {
    if (!data) return;
    setIsApproving(true);
    try {
      const payload = notes ? { judgementNotes: notes } : {};
      const res = await api.post(`/admin/reports/${reportId}/approve`, payload);
      if (res.data?.success || res.status === 200) {
        alert('Đã phê duyệt hồ sơ thành công!');
        onRefreshList();
        onClose();
      } else {
        alert(res.data?.message || 'Không thể phê duyệt hồ sơ.');
      }
    } catch (err: unknown) {
      console.error('[AuditStudioModal] Error approving:', err);
      const errMsg = getErrorMessage(err, 'Lỗi kết nối khi phê duyệt.');
      // Nếu gặp lỗi chốt chặn ECS >= 11 & BRA Thấp bắt buộc giải trình chuyên môn
      if (errMsg.includes('ECS ≥ 11') || errMsg.includes('giải trình chuyên môn') || errMsg.includes('judgementNotes')) {
        setJudgementNotesError(errMsg);
        setShowJudgementNotesModal(true);
      } else {
        alert(errMsg);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const getPhotoActionFieldKey = (act: PhotoActionPayload): string => {
    const base = `photo_action_${act.category || 'GEN'}_${act.targetPhotoId || act.targetPhotoType || act.photoCode || 'photo'}`;
    if (act.action === 'ADD') {
      const addId = act.newPhotoUrl || (act.newPhotoUrls && act.newPhotoUrls[0]) || String(Date.now());
      return `${base}_ADD_${addId}`;
    }
    const idxPart = act.photoIndex !== undefined ? `_idx${act.photoIndex}` : '';
    const urlPart = act.oldPhotoUrl ? `_${act.oldPhotoUrl.slice(-20)}` : '';
    return `${base}${idxPart}${urlPart}`;
  };

  // Handle Confirm Photo Action from AuditPhotoActionModal with In-Session Coalescence
  const handleConfirmPhotoAction = (action: PhotoActionPayload) => {
    const targetKey = getPhotoActionFieldKey(action);

    // 1. Tự động gộp (Coalesce) thông minh trên stagedPhotoActions (chỉ gộp REPLACE/DELETE trên cùng 1 slot ảnh, KHÔNG gộp ADD)
    setStagedPhotoActions((prev) => {
      if (action.action === 'ADD') {
        return [...prev, action];
      }

      const existingIdx = prev.findIndex(
        (a) =>
          a.action !== 'ADD' &&
          a.category === action.category &&
          (action.targetPhotoId ? a.targetPhotoId === action.targetPhotoId : true) &&
          (action.targetPhotoType ? a.targetPhotoType === action.targetPhotoType : true) &&
          a.photoIndex === action.photoIndex &&
          (!action.oldPhotoUrl || !a.oldPhotoUrl || a.oldPhotoUrl === action.oldPhotoUrl)
      );

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const coalescedAction: PhotoActionPayload = {
          ...action,
          oldPhotoUrl: existing.oldPhotoUrl || action.oldPhotoUrl,
        };
        const next = [...prev];
        next[existingIdx] = coalescedAction;
        return next;
      }
      return [...prev, action];
    });

    // 2. Tạo hoặc thay thế một DiffItem trực quan đưa vào stagedPhotoDiffs
    const diffLabel =
      action.action === 'REPLACE'
        ? `[Cập Nhật Ảnh] ${action.photoCode || action.targetPhotoType || 'Ảnh'}`
        : action.action === 'ADD'
          ? `[Ảnh Bổ Sung] ${action.photoCode || action.targetPhotoType || 'Ảnh'} (${action.newPhotoUrls?.length || 1} ảnh)`
          : action.action === 'RESTORE'
            ? `[Khôi Phục Ảnh] ${action.photoCode || action.targetPhotoType || 'Ảnh'}`
            : `[Xóa Ảnh] ${action.photoCode || action.targetPhotoType || 'Ảnh'}`;

    const newDiff: DiffItem = {
      field: targetKey,
      label: diffLabel,
      oldValue: action.oldPhotoUrl || '—',
      newValue:
        action.action === 'DELETE'
          ? action.isNotApplicable
            ? 'Không áp dụng (N/A)'
            : 'Đã xóa'
          : action.newPhotoUrl || (action.newPhotoUrls && action.newPhotoUrls.length > 0 ? action.newPhotoUrls[0] : 'Đã tải ảnh'),
      isPhoto: true,
    };

    setStagedPhotoDiffs((prev) => {
      const filtered = prev.filter((d) => d.field !== targetKey);
      return [...filtered, newDiff];
    });

    // 3. Đóng modal action
    setPhotoActionData((prev) => ({ ...prev, isOpen: false }));
  };

  // Hoàn tác thao tác ảnh staged
  const handleUndoPhotoAction = (actionToUndo: PhotoActionPayload) => {
    const fieldKeyToUndo = getPhotoActionFieldKey(actionToUndo);
    setStagedPhotoActions((prev) =>
      prev.filter((a) => {
        if (a === actionToUndo) return false;
        return getPhotoActionFieldKey(a) !== fieldKeyToUndo;
      })
    );
    setStagedPhotoDiffs((prev) => prev.filter((d) => d.field !== fieldKeyToUndo));
  };

  // E3: Kiểm tra tên chủ hộ thực tế cho hồ sơ khảo sát thường (NORMAL)
  const sJsonForOwnerCheck = (data?.surveyJson || data?.survey_data_json || {}) as Record<string, unknown>;
  const parcelForOwnerCheck = data?.parcel as { ownerName?: string; owner_name?: string } | undefined;
  const effectiveOwnerName =
    pendingDirtyData.updates.ownerName !== undefined
      ? String(pendingDirtyData.updates.ownerName)
      : String(
          sJsonForOwnerCheck.ownerName ||
            data?.ownerName ||
            parcelForOwnerCheck?.ownerName ||
            parcelForOwnerCheck?.owner_name ||
            ''
        );
  const caseTypeForOwnerCheck = String(sJsonForOwnerCheck.surveyCaseType || '').toUpperCase();
  const residentStatusForOwnerCheck = String(sJsonForOwnerCheck.residentStatus || data?.unitInfo?.resident_status || '').toUpperCase();
  const reportTypeForOwnerCheck = String(data?.reportType || '').toUpperCase();
  const isSpecialOrMasterForOwnerCheck = Boolean(
    data?.isRefusedOrAbsent ||
      data?.status === 'POSTPONED_ABSENT' ||
      sJsonForOwnerCheck.isAbsentee ||
      sJsonForOwnerCheck.isAbsenteeSurvey ||
      sJsonForOwnerCheck.isRefusedOrAbsent ||
      ['ABSENTEE', 'VACANT_LAND', 'UNDER_CONSTRUCTION'].includes(caseTypeForOwnerCheck) ||
      ['VẮNG_MẶT_KHÓA_CỬA', 'BỎ_TRỐNG_CHƯA_VỀ_Ở'].includes(residentStatusForOwnerCheck) ||
      ['BUILDING_MASTER', 'CONDO_MASTER', 'MASTER_AREA'].includes(reportTypeForOwnerCheck) ||
      data?.unitInfo?.unit_type === 'MASTER'
  );
  const isMissingRealOwnerName = Boolean(
    data &&
      !isSpecialOrMasterForOwnerCheck &&
      (!effectiveOwnerName.trim() || isCadastralOwnerPlaceholder(effectiveOwnerName))
  );

  // Handle Approve button click
  const handleApprove = async () => {
    if (!data) return;

    if (isMissingRealOwnerName) {
      alert(
        '⛔ Không thể phê duyệt: Hồ sơ khảo sát thường (NORMAL) đang thiếu Tên chủ sở hữu / người sử dụng thực tế (đang để trống hoặc còn tên giả định địa chính "Chủ hộ thửa...").\n\nVui lòng bấm "Yêu Cầu Khảo Sát Lại (Reject)" để Khảo sát viên bổ sung tên chủ hộ thực tế.'
      );
      setShowRejectModal(true);
      return;
    }

    // Ràng buộc kiểm toán: Nếu có diff chưa lưu -> Hiển thị popup cảnh báo 3 lựa chọn
    if (totalDiffCount > 0) {
      setShowUnsavedChangesWarning(true);
      return;
    }

    // Ràng buộc hướng ảnh Nhà Dân Thường: CHỈ CHẶN PHÊ DUYỆT khi có ảnh BẮT BUỘC (isStrict = true) bị ngược hướng
    const strictViolations = orientationAudit.violations.filter((v) => v.isStrict);
    if (orientationAudit.hasStrictViolations && strictViolations.length > 0) {
      setShowOrientationWarning(true);
      return;
    }

    // Ràng buộc chuẩn hóa địa chỉ (NQ 1685): Cảnh báo mềm nếu địa chỉ chưa chuẩn hóa hoặc ô đường bị nhiễm bẩn
    if (currentAddressEval && !currentAddressEval.isCompliant && (currentAddressEval.hasAnomalies || currentAddressEval.isContaminated)) {
      setShowAddressWarning(true);
      return;
    }

    const confirmMsg = `Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ thửa ${data.projectParcelCode}?\nHồ sơ sẽ được khóa bất biến và tự động ký số Zone Admin.`;
    if (!window.confirm(confirmMsg)) return;

    await executeApprove();
  };

  const handleDiscardAndApprove = async () => {
    setShowUnsavedChangesWarning(false);
    setStagedPhotoActions([]);
    setStagedPhotoDiffs([]);
    pendingDirtyData.discardAll(true);
    await executeApprove();
  };

  const handleSaveDiffFirst = () => {
    setShowUnsavedChangesWarning(false);
    const hasRotations = Object.keys(orientationAudit.stagedPhotoRotations).length > 0;
    const surveyJsonObj = ((data?.survey_data_json || data || {}) as Record<string, unknown>);
    const existingPhotoRotations = (surveyJsonObj.photoRotations || {}) as Record<string, number>;
    setDiffModalData({
      isOpen: true,
      diffItems: [...pendingDirtyData.diffItems, ...stagedPhotoDiffs],
      updates: {
        ...pendingDirtyData.updates,
        ...(hasRotations
          ? {
              photoRotations: {
                ...existingPhotoRotations,
                ...orientationAudit.stagedPhotoRotations,
              },
            }
          : {}),
      },
    });
  };

  const handleRevertToDraft = async () => {
    if (!data) return;
    const confirmMsg = `Bạn có chắc chắn muốn CHUYỂN VỀ "ĐANG LÀM DỞ" hồ sơ thửa ${data.projectParcelCode || reportId}?\n\nSau khi chuyển, khảo sát viên có thể tiếp tục chỉnh sửa trên hiện trường và nộp lại.`;
    if (!window.confirm(confirmMsg)) return;

    setIsReverting(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/revert-to-draft`, {});
      if (res.data?.success || res.status === 200) {
        alert('Đã chuyển trạng thái hồ sơ về "Đang làm dở" thành công!');
        onRefreshList();
        onClose();
      } else {
        alert(res.data?.message || 'Không thể chuyển trạng thái hồ sơ.');
      }
    } catch (err: unknown) {
      console.error('[AuditStudioModal] Error reverting:', err);
      alert(getErrorMessage(err, 'Lỗi kết nối khi chuyển trạng thái.'));
    } finally {
      setIsReverting(false);
    }
  };

  const auditFlags = data?.auditWarningFlags || data?.auditFlags || [];
  const riskCard = data?.leftPane?.riskScoreCard;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4 overflow-y-auto'}`}>
      <div className={`relative w-full bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 ${isFullscreen ? 'h-screen w-screen rounded-none' : 'max-w-7xl h-[92vh] rounded-2xl'}`}>
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm text-emerald-400">
                  {data?.projectParcelCode || 'Đang tải...'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs font-bold text-white">
                  {data?.houseNumber ? `${data.houseNumber} ${data.street}` : 'Địa chỉ chưa cập nhật'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {data?.zoneId || 'ZONE'}
                </span>
                {data?.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${data.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : data.status === 'POSTPONED_ABSENT'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : data.status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                  >
                    {data.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                <span>KSV: <strong>{data?.surveyorName || '---'}</strong></span>
                {data?.surveyorPhone && <span>• SĐT: {data.surveyorPhone}</span>}
                {data?.surveyDate && (
                  <span>
                    • Khảo sát: {new Date(data.surveyDate).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Version History & Rollback Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${showVersionDropdown
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                  }`}
                title="Lịch sử các phiên bản và so sánh đối chiếu"
              >
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  v{versions.length > 0 ? versions[0].versionNumber : 0} ({versions.length} phiên bản)
                </span>
                <ChevronDown className="w-3 h-3 text-indigo-300 ml-0.5" />
              </button>

              {showVersionDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 text-slate-100 z-50 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-300">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      <span>Lịch Sử Phiên Bản ({versions.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVersionDropdown(false)}
                      className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs pr-1">
                    {versions.map((ver, vIdx) => {
                      const isLatest = vIdx === 0;
                      return (
                        <div
                          key={ver.id || ver.versionNumber}
                          onClick={() => {
                            setShowVersionDropdown(false);
                            setShowVersionComparison(true);
                          }}
                          className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-400">v{ver.versionNumber}</span>
                              <span className="font-semibold text-[11px] text-slate-200 truncate max-w-[150px]">
                                {ver.title}
                              </span>
                            </div>
                            {isLatest && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                                Hiện tại
                              </span>
                            )}
                          </div>
                          {ver.editReason && (
                            <p className="text-[11px] text-slate-400 italic line-clamp-1">
                              &ldquo;{ver.editReason}&rdquo;
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50 mt-0.5">
                            <span>{ver.createdByName || 'Admin'}</span>
                            <span>{new Date(ver.createdAt).toLocaleString('vi-VN')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowVersionDropdown(false);
                      setShowVersionComparison(true);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Mở Studio So Sánh & Hoàn Nguyên</span>
                  </button>
                </div>
              )}
            </div>

            {data?.auditHistory && (
              <button
                type="button"
                onClick={() => setShowAuditHistory(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${data.auditHistory.length > 0
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                  }`}
                title="Xem nhật ký kiểm toán và lịch sử sửa đổi"
              >
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>Nhật ký ({data.auditHistory.length})</span>
              </button>
            )}

            {/* Interactive Warning Flags Button & Popover */}
            {auditFlags.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFlagsPopover(!showFlagsPopover)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${showFlagsPopover
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                  title="Bấm để xem danh sách chi tiết các cờ cảnh báo rủi ro"
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${showFlagsPopover ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{auditFlags.length} Cờ cảnh báo</span>
                </button>

                {showFlagsPopover && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800 z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>Danh Sách Cảnh Báo Hồ Sơ ({auditFlags.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFlagsPopover(false)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs pr-1">
                      {auditFlags.map((flag: { code: string; level: 'WARNING' | 'INFO'; message: string }, fIdx: number) => {
                        const isWarn = flag.level === 'WARNING';
                        return (
                          <div
                            key={flag.code || fIdx}
                            className={`p-2.5 rounded-lg border flex items-start gap-2 ${isWarn ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-sky-50/70 border-sky-200 text-sky-950'
                              }`}
                          >
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isWarn ? 'bg-amber-500' : 'bg-sky-500'}`} />
                            <div className="flex-1">
                              <p className="font-semibold text-[11px] leading-snug">{flag.message}</p>
                              <span className="text-[9px] font-mono text-slate-400 uppercase mt-0.5 block">{flag.code}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={fetchAuditData}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ về dạng cửa sổ nổi' : 'Mở rộng toàn màn hình Workspace'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Đóng studio thẩm định"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: 100% Stepwise Document View (No Split-Pane) */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-sm font-bold">Đang tải hồ sơ thẩm định chi tiết...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-sm font-bold">{errorMsg}</span>
            <button
              type="button"
              onClick={fetchAuditData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div id="audit-studio-scroll-container" className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
            {(() => {
              const isCondoUnit = Boolean(
                data?.unitInfo?.unit_type === 'UNIT' ||
                data?.reportType === 'CONDO_UNIT' ||
                data?.reportType === 'UNIT_CHILD' ||
                data?.unitInfo?.unit_code?.startsWith('U-')
              );

              const isMasterArea = Boolean(
                data?.unitInfo?.unit_type === 'MASTER' ||
                data?.reportType === 'MASTER_AREA' ||
                data?.unitInfo?.unit_code?.startsWith('M-')
              );

              const isCondoMaster = Boolean(
                (data?.buildingType?.includes('CONDO') || data?.parentBuildingInfo?.buildingType?.includes('CONDO')) &&
                !data?.unitId &&
                (data?.reportType === 'CONDO_MASTER' || data?.reportType === 'BUILDING_MASTER' || !data?.reportType)
              );

              if (isCondoUnit) {
                return (
                  <CondoUnitAuditStudioView
                    data={data || {}}
                    reportId={reportId}
                    onRefresh={fetchAuditData}
                    onOpenPhotoZoom={(url, title) => {
                      setSelectedPhotoUrl(url);
                      setSelectedPhotoTitle(title || 'Ảnh Căn Hộ');
                      setShowImageZoom(true);
                    }}
                    onOpenPhotoReplace={(params) => {
                      setPhotoReplaceData({
                        isOpen: true,
                        targetPhotoType: params.targetPhotoType,
                        targetPhotoId: params.targetPhotoId,
                        defectId: params.defectId,
                        zoneId: params.zoneId,
                        photoIndex: params.photoIndex,
                        currentPhotoUrl: params.currentPhotoUrl,
                        photoTitle: params.photoTitle,
                      });
                    }}
                    onOpenDiffModal={(diffItems, updates) => {
                      setDiffModalData({
                        isOpen: true,
                        diffItems: [...diffItems, ...stagedPhotoDiffs],
                        updates,
                      });
                    }}
                    onOpenEngineeringJudgement={() => setShowJudgementModal(true)}
                    onOpenRejectModal={() => setShowRejectModal(true)}
                    onClose={onClose}
                  />
                );
              }

              if (isMasterArea) {
                return (
                  <CondoMasterAreaAuditStudioView
                    data={data || {}}
                    reportId={reportId}
                    onRefresh={fetchAuditData}
                    onOpenPhotoZoom={(url, title) => {
                      setSelectedPhotoUrl(url);
                      setSelectedPhotoTitle(title || 'Ảnh Khu Vực Dùng Chung');
                      setShowImageZoom(true);
                    }}
                    onOpenPhotoReplace={(params) => {
                      setPhotoReplaceData({
                        isOpen: true,
                        targetPhotoType: params.targetPhotoType,
                        targetPhotoId: params.targetPhotoId,
                        defectId: params.defectId,
                        zoneId: params.zoneId,
                        photoIndex: params.photoIndex,
                        currentPhotoUrl: params.currentPhotoUrl,
                        photoTitle: params.photoTitle,
                      });
                    }}
                    onOpenDiffModal={(diffItems, updates) => {
                      setDiffModalData({
                        isOpen: true,
                        diffItems: [...diffItems, ...stagedPhotoDiffs],
                        updates,
                      });
                    }}
                    onOpenEngineeringJudgement={() => setShowJudgementModal(true)}
                    onOpenRejectModal={() => setShowRejectModal(true)}
                    onClose={onClose}
                  />
                );
              }

              if (isCondoMaster) {
                return (
                  <CondoMasterAuditStudioView
                    data={data || {}}
                    reportId={reportId}
                    onRefresh={fetchAuditData}
                    onOpenPhotoZoom={(url, title) => {
                      setSelectedPhotoUrl(url);
                      setSelectedPhotoTitle(title || 'Ảnh Tòa Mẹ');
                      setShowImageZoom(true);
                    }}
                    onOpenPhotoReplace={(params) => {
                      setPhotoReplaceData({
                        isOpen: true,
                        targetPhotoType: params.targetPhotoType,
                        targetPhotoId: params.targetPhotoId,
                        defectId: params.defectId,
                        zoneId: params.zoneId,
                        photoIndex: params.photoIndex,
                        currentPhotoUrl: params.currentPhotoUrl,
                        photoTitle: params.photoTitle,
                      });
                    }}
                    onOpenDiffModal={(diffItems, updates) => {
                      setDiffModalData({
                        isOpen: true,
                        diffItems: [...diffItems, ...stagedPhotoDiffs],
                        updates,
                      });
                    }}
                    onOpenEngineeringJudgement={() => setShowJudgementModal(true)}
                    onOpenRejectModal={() => setShowRejectModal(true)}
                    onClose={onClose}
                  />
                );
              }

              return (
                <AuditStepwiseDocumentView
                  data={data || {}}
                  reportId={reportId}
                  onRefresh={fetchAuditData}
                  onOpenPhotoZoom={(url, title, photoCode, rotation) => {
                    setSelectedPhotoUrl(url);
                    setSelectedPhotoTitle(title || 'Ảnh Hiện Trường');
                    setSelectedPhotoCode(photoCode || '');
                    setSelectedPhotoRotation(rotation || 0);
                    setShowImageZoom(true);
                  }}
                  onOrientationAuditChange={setOrientationAudit}
                  onOpenPhotoReplace={(params) => {
                    setPhotoActionData({
                      isOpen: true,
                      initialMode: 'REPLACE',
                      category: params.targetPhotoType.includes('DEFECT')
                        ? 'DEFECT_CU'
                        : params.targetPhotoType.includes('ZONE')
                          ? 'ZONE_CTX'
                          : params.targetPhotoType.includes('FLOOR')
                            ? 'CAD_FLOOR'
                            : 'IDENTIFICATION',
                      targetPhotoType: params.targetPhotoType,
                      targetPhotoId: params.targetPhotoId,
                      defectId: params.defectId,
                      zoneCode: params.zoneId,
                      photoIndex: params.photoIndex,
                      currentPhotoUrl: params.currentPhotoUrl,
                      photoTitle: params.photoTitle,
                    });
                  }}
                  onOpenPhotoAction={(params) => {
                    setPhotoActionData({
                      isOpen: true,
                      ...params,
                    });
                  }}
                  onOpenPhotoHistory={(params) => {
                    setPhotoHistoryData({
                      isOpen: true,
                      ...params,
                    });
                  }}
                  onOpenDiffModal={(diffItems, updates) => {
                    setDiffModalData({
                      isOpen: true,
                      diffItems: [...diffItems, ...stagedPhotoDiffs],
                      updates,
                    });
                  }}
                  onOpenEngineeringJudgement={() => setShowJudgementModal(true)}
                  onDirtyChange={setPendingDirtyData}
                  stagedPhotoActions={stagedPhotoActions}
                  onUndoPhotoAction={handleUndoPhotoAction}
                  onDiscardAllStagedPhotos={() => {
                    setStagedPhotoActions([]);
                    setStagedPhotoDiffs([]);
                  }}
                />
              );
            })()}
          </div>
        )}

        {isMissingRealOwnerName && data?.status !== 'APPROVED' && (
          <div className="px-4 py-2.5 bg-red-50 border-t border-red-200 flex items-center justify-between gap-3 text-xs text-red-900 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                <strong>⛔ CHẶN PHÊ DUYỆT:</strong> Hồ sơ khảo sát thường (NORMAL) đang thiếu <strong>Tên chủ sở hữu / người sử dụng thực tế</strong> (đang để trống hoặc còn giữ tên giả định địa chính). Vui lòng bấm <strong>&ldquo;Yêu Cầu Khảo Sát Lại (Reject)&rdquo;</strong> để Khảo sát viên bổ sung.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
            >
              Trả về bổ sung ngay
            </button>
          </div>
        )}

        {/* Bottom Footer: Decision Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">
              Thẩm định hồ sơ: <strong className="text-slate-800 font-mono">{data?.projectParcelCode || reportId}</strong>
            </span>
            {totalDiffCount > 0 && (
              <button
                type="button"
                onClick={handleSaveDiffFirst}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1.5 animate-pulse cursor-pointer transition-all"
                title="Bấm để xem danh sách diff và xác nhận lưu thay đổi"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {totalDiffCount} thay đổi chưa lưu (Bấm để xem & lưu diff)
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {totalDiffCount > 0 && (
              <button
                type="button"
                onClick={handleSaveDiffFirst}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/25 cursor-pointer animate-pulse"
                title="Xem bảng so sánh và lưu các thay đổi vào cơ sở dữ liệu"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Thay Đổi ({totalDiffCount})</span>
              </button>
            )}

            {data?.status !== 'APPROVED' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4 text-rose-600" />
                  <span>Yêu Cầu Khảo Sát Lại (Reject)</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isApproving || data?.status === 'APPROVED' || totalDiffCount > 0 || isMissingRealOwnerName}
              onClick={handleApprove}
              title={
                isMissingRealOwnerName
                  ? 'Hồ sơ thiếu tên chủ hộ thực tế. Vui lòng bấm Yêu Cầu Khảo Sát Lại (Reject) để KSV bổ sung.'
                  : totalDiffCount > 0
                    ? 'Vui lòng bấm Lưu Thay Đổi để lưu các diff trước khi phê duyệt'
                    : 'Phê duyệt hồ sơ'
              }
              className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md ${data?.status === 'APPROVED'
                  ? 'bg-emerald-700/90 text-white cursor-default'
                  : totalDiffCount > 0 || isMissingRealOwnerName
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isApproving
                  ? 'Đang ký duyệt...'
                  : data?.status === 'APPROVED'
                    ? '✓ Đã Khóa Duyệt'
                    : isMissingRealOwnerName
                      ? '⛔ Thiếu Tên Chủ Hộ (Cần Trả Về)'
                      : totalDiffCount > 0
                        ? ' Khóa Duyệt (Còn Diff Chưa Lưu)'
                        : 'Phê Duyệt Hồ Sơ (Approve)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Child Modals */}
      {showRejectModal && data && (
        <RejectReportModal
          isOpen={showRejectModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode || ''}
          surveyorName={data.surveyorName}
          onClose={() => setShowRejectModal(false)}
          onSuccess={() => {
            alert('Đã gửi yêu cầu bổ sung cho Surveyor thành công!');
            onRefreshList();
            onClose();
          }}
        />
      )}

      {showJudgementModal && data && (
        <EngineeringJudgementModal
          isOpen={showJudgementModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode || ''}
          currentBurlandGrade={riskCard?.e1_burland_score !== undefined ? `Cấp ${riskCard.e1_burland_score}` : (data?.surveyJson?.ecs?.e1 !== undefined ? `Cấp ${data.surveyJson.ecs.e1}` : undefined)}
          riskCard={riskCard}
          data={data}
          onClose={() => setShowJudgementModal(false)}
          onSuccess={() => {
            alert('Đã lưu phán quyết chuyên gia thành công!');
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {showImageZoom && selectedPhotoUrl && (
        <ImageZoomModal
          isOpen={showImageZoom}
          imageUrl={selectedPhotoUrl}
          title={selectedPhotoTitle}
          initialRotation={selectedPhotoRotation}
          onSaveRotation={(deg) => {
            const rotKey = selectedPhotoCode || selectedPhotoUrl;
            if (rotKey) {
              if (orientationAudit.rotatePhoto) {
                orientationAudit.rotatePhoto(rotKey, deg, selectedPhotoCode ? undefined : selectedPhotoUrl);
              } else {
                setOrientationAudit((prev) => ({
                  ...prev,
                  stagedPhotoRotations: {
                    ...prev.stagedPhotoRotations,
                    [rotKey]: deg,
                  },
                }));
              }
            }
            setSelectedPhotoRotation(deg);
          }}
          onClose={() => setShowImageZoom(false)}
        />
      )}

      {/* Modal xác nhận phê duyệt khi có ảnh lệch chuẩn kỹ thuật (Approval Gatekeeper) */}
      {showOrientationWarning && (() => {
        const strictViolations = orientationAudit.violations.filter((v) => v.isStrict);
        return (
          <div className="fixed inset-0 z-[100] isolate flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="relative z-[101] bg-white rounded-2xl shadow-2xl border-2 border-amber-500 max-w-lg w-full p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-slate-900">
                    Cảnh Báo: {strictViolations.length} Ảnh BẮT BUỘC Chưa Khớp Khổ In A4
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Các ảnh bắt buộc (mặt đứng P-02, mặt bên P-03, thước đo nứt D-CU, bản vẽ CAD...) cần xoay đúng chiều để không làm nổ vỡ khung hình trang A4 nghiệm thu.
                  </p>
                </div>
              </div>

              {/* Danh sách ảnh vi phạm bắt buộc */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 space-y-1.5">
                {strictViolations.map((v, vIdx) => (
                  <div
                    key={`${v.key}_${vIdx}`}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-black text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 border border-amber-600">
                        {v.photoCode || 'Bắt buộc'}
                      </span>
                      <span className="truncate text-slate-800 font-bold">{v.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0 font-mono">
                      Đang là <strong className="text-rose-600">{v.currentOrientation}</strong> ➔ Cần <strong className="text-emerald-700">{v.expectedOrientation}</strong>
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 leading-normal">
                <strong>Khuyến nghị:</strong> Bạn nên bấm <em>Quay lại điều chỉnh</em> để xoay ảnh ngay ngắn. Nếu đây là trường hợp đặc thù ngoài hiện trường, bạn có thể chọn <em>Bỏ qua & Phê duyệt</em> (hệ thống sẽ lưu vết log kiểm toán ngoại lệ kỹ thuật).
              </div>

              {/* 2 nút quyết định */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowOrientationWarning(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Quay Lại Điều Chỉnh Ảnh
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    console.warn('[AuditStudioModal] Admin bypassed orientation violation for strict photos:', strictViolations.map(v => v.photoCode || v.key));
                    setShowOrientationWarning(false);
                    // Chaining Gatekeeper: Tiếp tục kiểm tra chốt chặn Địa chỉ NQ 1685 nếu có
                    if (currentAddressEval && !currentAddressEval.isCompliant && (currentAddressEval.hasAnomalies || currentAddressEval.isContaminated)) {
                      setShowAddressWarning(true);
                      return;
                    }
                    const confirmMsg = `Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ thửa ${data?.projectParcelCode || ''}?\nHồ sơ sẽ được khóa bất biến và tự động ký số Zone Admin.`;
                    if (!window.confirm(confirmMsg)) return;
                    await executeApprove();
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                >
                  Bỏ Qua & Phê Duyệt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal xác nhận phê duyệt khi địa chỉ chưa chuẩn hóa (Soft Approval Gatekeeper - NQ 1685) */}
      {showAddressWarning && (
        <div className="fixed inset-0 z-[100] isolate flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative z-[101] bg-white rounded-2xl shadow-2xl border border-amber-300 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-300">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900">
                  Cảnh Báo Thông Tin Địa Chỉ Chưa Chuẩn Hóa
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Hồ sơ hiện còn thông tin địa chỉ chưa chuẩn hóa theo quy chuẩn hành chính sau sáp nhập (NQ 1685/NQ-UBTVQH15) hoặc chứa lỗi chính tả, viết tắt.
                </p>
              </div>
            </div>

            {/* Chi tiết cảnh báo */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Các điểm cần lưu ý:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                {currentAddressEval?.anomalyReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              {currentAddressEval?.isContaminated && (
                <div className="mt-2 text-rose-800 font-bold bg-rose-100/80 p-2 rounded-lg border border-rose-300">
                  ⚠️ Ô Tên đường đang bị điền nhầm tên Phường. Báo cáo in ấn sẽ bị sai lệch nếu chưa điều chỉnh!
                </div>
              )}
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Bạn có muốn quay lại để chuẩn hóa tự động hay bỏ qua và tiếp tục phê duyệt?
            </p>

            {/* 2 nút quyết định */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddressWarning(false)}
                className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
              >
                Quay Lại Chuẩn Hóa Địa Chỉ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowAddressWarning(false);
                  const confirmMsg = `Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ thửa ${data?.projectParcelCode}?\nHồ sơ sẽ được khóa bất biến và tự động ký số Zone Admin.`;
                  if (!window.confirm(confirmMsg)) return;
                  await executeApprove();
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                Bỏ Qua & Tiếp Tục Phê Duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Yêu Cầu Giải Trình Chuyên Môn Kỹ Sư Trưởng (Chốt chặn ECS ≥ 11 & BRA Thấp) */}
      {showJudgementNotesModal && (
        <div className="fixed inset-0 z-[110] isolate flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative z-[111] bg-white rounded-2xl shadow-2xl border border-rose-300 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900">
                  Yêu Cầu Giải Trình Chuyên Môn Kỹ Sư Trưởng
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Hồ sơ công trình có mức độ suy giảm hiện trạng cao (ECS ≥ 11) nhưng mức đánh giá rủi ro cơ sở BRA là Thấp. Quy chuẩn bắt buộc Zone Admin / Kỹ sư trưởng phải nhập lý do giải trình chuyên môn trước khi phê duyệt.
                </p>
              </div>
            </div>

            {judgementNotesError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {judgementNotesError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Lý do giải trình kỹ thuật chuyên môn:</span>
                <span className={`text-[11px] font-mono ${judgementNotesInput.trim().length >= 10 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}`}>
                  {judgementNotesInput.trim().length} / 10 ký tự tối thiểu
                </span>
              </label>
              <textarea
                rows={4}
                value={judgementNotesInput}
                onChange={(e) => setJudgementNotesInput(e.target.value)}
                placeholder="Nhập chi tiết giải trình chuyên môn (ví dụ: Nứt bề mặt do co ngót vữa trát, kết cấu dầm cột chịu lực không biến dạng lún nghiêng...)"
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowJudgementNotesModal(false);
                  setJudgementNotesError('');
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={judgementNotesInput.trim().length < 10 || isApproving}
                onClick={async () => {
                  const notes = judgementNotesInput.trim();
                  if (notes.length < 10) return;
                  setShowJudgementNotesModal(false);
                  await executeApprove(notes);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Xác Nhận & Phê Duyệt</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {diffModalData.isOpen && (
        <AuditDiffConfirmModal
          isOpen={diffModalData.isOpen}
          reportId={reportId}
          parcelCode={data?.projectParcelCode}
          diffItems={diffModalData.diffItems}
          updatesPayload={diffModalData.updates}
          formState={{
            ...((data?.surveyJson || data?.survey_data_json || {}) as Record<string, unknown>),
            ...pendingDirtyData.updates,
          }}
          photoActions={stagedPhotoActions}
          onDiscardDiffItem={(fieldKey: string) => {
            if (fieldKey.startsWith('photo_action_')) {
              setStagedPhotoActions((prev) => prev.filter((a) => getPhotoActionFieldKey(a) !== fieldKey));
              setStagedPhotoDiffs((prev) => prev.filter((d) => d.field !== fieldKey));
            } else if (fieldKey === 'photoRotations') {
              const origRots = ((data?.surveyJson?.photoRotations ||
                (data?.survey_data_json as Record<string, unknown> | undefined)?.photoRotations ||
                {}) as Record<string, number>);
              setOrientationAudit((prev) => ({
                ...prev,
                stagedPhotoRotations: { ...origRots },
              }));
              pendingDirtyData.discardDiffItem?.(fieldKey);
            } else {
              pendingDirtyData.discardDiffItem?.(fieldKey);
            }
            setDiffModalData((prev) => ({
              ...prev,
              diffItems: prev.diffItems.filter((i) => i.field !== fieldKey),
            }));
          }}
          onJumpToStep={(stepId: number) => {
            setDiffModalData({ isOpen: false, diffItems: [], updates: {} });
            const el = document.getElementById(`step-${stepId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onClose={() => setDiffModalData({ isOpen: false, diffItems: [], updates: {} })}
          onSuccess={() => {
            setStagedPhotoActions([]);
            setStagedPhotoDiffs([]);
            pendingDirtyData.discardAll(true);
            fetchAuditData();
            onRefreshList();
            alert('Đã lưu thay đổi vào cơ sở dữ liệu thành công! Vui lòng kiểm tra lại hồ sơ trước khi bấm Phê duyệt.');
          }}
        />
      )}

      {photoActionData.isOpen && (
        <AuditPhotoActionModal
          isOpen={photoActionData.isOpen}
          onClose={() => setPhotoActionData((prev) => ({ ...prev, isOpen: false }))}
          reportId={reportId}
          parcelCode={data?.projectParcelCode || 'HCM_M2'}
          initialMode={photoActionData.initialMode || 'REPLACE'}
          category={photoActionData.category}
          targetPhotoType={photoActionData.targetPhotoType}
          targetPhotoId={photoActionData.targetPhotoId}
          defectId={photoActionData.defectId}
          defectCode={photoActionData.defectCode}
          hasMultiplePhotos={photoActionData.hasMultiplePhotos}
          currentPhotoUrl={photoActionData.currentPhotoUrl}
          currentPhotoCode={photoActionData.currentPhotoCode}
          photoTitle={photoActionData.photoTitle}
          floorCode={photoActionData.floorCode}
          zoneCode={photoActionData.zoneCode}
          photoIndex={photoActionData.photoIndex}
          initialPinX={photoActionData.initialPinX}
          initialPinY={photoActionData.initialPinY}
          onConfirmAction={handleConfirmPhotoAction}
        />
      )}

      {photoHistoryData.isOpen && (
        <AuditPhotoHistoryModal
          isOpen={photoHistoryData.isOpen}
          onClose={() => setPhotoHistoryData((prev) => ({ ...prev, isOpen: false }))}
          reportId={reportId}
          photoCode={photoHistoryData.photoCode}
          photoType={photoHistoryData.photoType}
          photoTitle={photoHistoryData.photoTitle}
          currentPhotoUrl={photoHistoryData.currentPhotoUrl}
          onPhotoRestored={() => {
            fetchAuditData();
            fetchVersions();
            onRefreshList();
          }}
          onStageRestoreAction={(photo, reason) => {
            const action: PhotoActionPayload = {
              action: 'RESTORE',
              category: photo.photo_category,
              targetPhotoType: photo.photo_type,
              targetPhotoId: photo.metadata_json?.targetPhotoId || photo.metadata_json?.defectId || photo.metadata_json?.zoneId,
              photoIndex: photo.metadata_json?.photoIndex,
              oldPhotoUrl: photoHistoryData.currentPhotoUrl,
              newPhotoUrl: photo.photo_url,
              photoCode: photo.photo_code,
              reason,
            };
            handleConfirmPhotoAction(action);
            setPhotoHistoryData((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      )}

      {showAuditHistory && (
        <AuditHistoryModal
          isOpen={showAuditHistory}
          onClose={() => setShowAuditHistory(false)}
          reportCode={data?.reportCode || undefined}
          parcelCode={data?.projectParcelCode || undefined}
          logs={data?.auditHistory || []}
        />
      )}

      {showVersionComparison && (
        <VersionComparisonModal
          isOpen={showVersionComparison}
          reportId={reportId}
          parcelCode={data?.projectParcelCode || ''}
          reportCode={data?.reportCode || ''}
          currentData={data}
          onClose={() => setShowVersionComparison(false)}
          onRollbackSuccess={() => {
            fetchAuditData();
            fetchVersions();
            onRefreshList();
          }}
        />
      )}

      {/* Modal Cảnh Báo 3 Lựa Chọn Khi Có Diff Chưa Lưu & Bấm Phê Duyệt */}
      {showUnsavedChangesWarning && (
        <div className="fixed inset-0 z-[100] isolate flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative z-[101] w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-300 overflow-hidden">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Cảnh Báo: Có Dữ Liệu Chưa Lưu!</h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Hồ sơ đang có <strong>{pendingDirtyData.dirtyCount}</strong> mục đã chỉnh sửa nhưng chưa xác nhận lưu vào CSDL.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                Bạn vừa bấm <strong>Phê Duyệt Hồ Sơ</strong> trong khi còn các thay đổi chưa được lưu. Vui lòng chọn cách xử lý bên dưới:
              </p>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1.5 font-mono text-[11px] max-h-36 overflow-y-auto">
                <div className="font-bold text-amber-900 text-xs mb-1 font-sans">Các trường đã chỉnh sửa:</div>
                {pendingDirtyData.diffItems.map((d, i) => (
                  <div key={i} className="truncate text-slate-700">
                    • <strong>{d.label}:</strong> {String(d.oldValue ?? '—')} → <span className="text-amber-800 font-bold">{String(d.newValue ?? '—')}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveDiffFirst}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>1. Lưu Thay Đổi Trước (Mở Modal Diff)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAndApprove}
                  className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4 text-amber-700" />
                  <span>2. Hủy Thay Đổi & Duyệt Bản Gốc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsavedChangesWarning(false)}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  3. Quay Lại Kiểm Tra Tiếp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
