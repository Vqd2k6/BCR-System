import React, { useState } from 'react';
import {
  Building2,
  Home,
  User,
  Phone,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Camera,
  MapPin,
  Layers,
  ShieldCheck,
  Droplet,
  Maximize2,
  Edit3,
  Save,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { isCadastralOwnerPlaceholder } from '@/features/survey-phase1/utils/stepValidator';
import type { AuditStepwiseData, DiffItem, PhotoReplaceParams } from '../stepwise/types';

interface Props {
  data: AuditStepwiseData;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, unknown>) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenEngineeringJudgement: () => void;
  onOpenRejectModal: () => void;
  onClose: () => void;
}

export const CondoUnitAuditStudioView: React.FC<Props> = ({
  data,
  reportId,
  onRefresh,
  onOpenPhotoZoom,
  onOpenDiffModal,
  onOpenPhotoReplace,
  onOpenEngineeringJudgement,
  onOpenRejectModal,
  onClose,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApprovingAbsentee, setIsApprovingAbsentee] = useState(false);
  const [absenteeNotes, setAbsenteeNotes] = useState('');
  const [showAbsenteeConfirm, setShowAbsenteeConfirm] = useState(false);

  // In-place edit state
  const surveyJsonInit = (data.surveyJson || data.survey_data_json || {}) as Record<string, any>;
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayCode, setEditDisplayCode] = useState(
    String(surveyJsonInit.displayCode || data.unitInfo?.display_code || data.unitInfo?.unit_code || '')
  );
  const [editUnitAreaM2, setEditUnitAreaM2] = useState(
    String(surveyJsonInit.unitAreaM2 ?? data.unitInfo?.unit_area_m2 ?? '')
  );
  const [editOwnerName, setEditOwnerName] = useState(data.unitInfo?.owner_name || data.ownerName || '');
  const [editOwnerPhone, setEditOwnerPhone] = useState(data.unitInfo?.owner_phone || data.ownerPhone || '');
  const [editOwnerIdCard, setEditOwnerIdCard] = useState(
    String(surveyJsonInit.ownerIdCard || data.unitInfo?.owner_id_card || '')
  );
  const [editResidentStatus, setEditResidentStatus] = useState(data.unitInfo?.resident_status || 'CHỦ_HỘ_Ở');
  const [editDoorJammingStatus, setEditDoorJammingStatus] = useState(
    String(surveyJsonInit.doorJammingStatus || 'NORMAL')
  );
  const [editHasWaterLeak, setEditHasWaterLeak] = useState(
    Boolean(surveyJsonInit.upperFloorWaterLeakage?.has)
  );
  const [editWaterLeakDesc, setEditWaterLeakDesc] = useState(
    String(surveyJsonInit.upperFloorWaterLeakage?.description || surveyJsonInit.upperFloorWaterLeakage?.leakageItems?.[0]?.description || '')
  );
  const [editBeamSagMm, setEditBeamSagMm] = useState(
    String(surveyJsonInit.beamSagging?.sagMm ?? '')
  );
  const [editBeamSpanM, setEditBeamSpanM] = useState(
    String(surveyJsonInit.beamSagging?.spanM ?? '')
  );
  const [editSummaryConclusions, setEditSummaryConclusions] = useState(
    String(surveyJsonInit.summaryConclusions || data.summaryConclusions || '')
  );
  const [editEngineeringRecs, setEditEngineeringRecs] = useState(data.engineeringRecommendations || '');
  const [editOwnerFeedback, setEditOwnerFeedback] = useState(
    String(surveyJsonInit.ownerFeedback || surveyJsonInit.ownerRemarks || '')
  );
  const [editReason, setEditReason] = useState('');

  const surveyJson = data.surveyJson || data.survey_data_json || {};
  const unitInfo = data.unitInfo;
  const parentBuilding = data.parentBuildingInfo;
  const floorPlan = data.floorPlanInfo;
  const auditFlags = data.auditWarningFlags || [];

  const isAbsent = Boolean(data.isRefusedOrAbsent || data.status === 'POSTPONED_ABSENT' || unitInfo?.status === 'POSTPONED_ABSENT');
  const isAbsentVerified = unitInfo?.status === 'POSTPONED_ABSENT_VERIFIED';
  const isApproved = data.status === 'APPROVED' || unitInfo?.status === 'APPROVED';

  const currentResidentStatus = String(unitInfo?.resident_status || surveyJsonInit.residentStatus || 'CHỦ_HỘ_Ở');
  const currentOwnerName = String(unitInfo?.owner_name || data.ownerName || surveyJsonInit.ownerName || '').trim();
  const isMissingRealOwnerName =
    !isAbsent &&
    currentResidentStatus !== 'VẮNG_MẶT_KHÓA_CỬA' &&
    currentResidentStatus !== 'BỎ_TRỐNG_CHƯA_VỀ_Ở' &&
    currentResidentStatus !== 'ĐỂ_TRỐNG' &&
    (!currentOwnerName || isCadastralOwnerPlaceholder(currentOwnerName));

  // Photo helpers
  const identPhotos = data.rightPane?.identificationPhotos || data.identificationPhotos;
  const p01Raw = identPhotos?.photoP01 || (surveyJson.photoP01 as unknown);
  const p01Url = typeof p01Raw === 'string' ? p01Raw : (p01Raw as { url?: string } | undefined)?.url || null;

  const p04Raw = identPhotos?.photoP04 || (surveyJson.photoP04 as unknown);
  const p04Url = typeof p04Raw === 'string' ? p04Raw : (p04Raw as { url?: string } | undefined)?.url || null;

  // Extract defects and damage zones
  const damageZones = (data.leftPane?.damageZones || surveyJson.zones || []) as Array<{
    id?: string;
    zone_code?: string;
    room_name?: string;
    component_type?: string;
    ctx_photo_url?: string;
    defects?: Array<{
      id?: string;
      defectCode?: string;
      defect_code?: string;
      widthMaxMm?: number;
      width_max_mm?: number;
      lengthMm?: number;
      length_mm?: number;
      hasScaleCard?: boolean;
      has_scale_card?: boolean;
      isStructuralCritical?: boolean;
      is_structural_critical?: boolean;
      cuPhotoUrl?: string;
      cu_photo_url?: string;
      cuPhotos?: string[];
    }>;
  }>;

  // Handle standard Approve
  const handleApprove = async () => {
    if (isMissingRealOwnerName) {
      alert(
        'Căn hộ chưa có Tên chủ hộ/người đại diện hợp lệ (đang trống hoặc vẫn giữ tên mặc định "Chủ hộ thửa..."). Vui lòng bấm "Trả về (Reject)" để KSV bổ sung tên chủ hộ thật trước khi phê duyệt!'
      );
      onOpenRejectModal();
      return;
    }
    if (!window.confirm(`Xác nhận phê duyệt thẩm định Căn hộ ${unitInfo?.display_code || unitInfo?.unit_code || data.projectParcelCode}?`)) {
      return;
    }
    setIsApproving(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/approve`, {});
      if (res.data?.success || res.status === 200) {
        alert('Phê duyệt căn hộ thành công!');
        onRefresh();
        onClose();
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Lỗi khi phê duyệt căn hộ'));
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Approve Absentee
  const handleApproveAbsentee = async () => {
    setIsApprovingAbsentee(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/approve-absentee`, {
        judgementNotes: absenteeNotes || 'Xác nhận vắng mặt hợp lệ bởi Zone Admin',
      });
      if (res.data?.success || res.status === 200) {
        alert('Đã xác nhận vắng mặt hợp lệ (POSTPONED_ABSENT_VERIFIED)!');
        setShowAbsenteeConfirm(false);
        onRefresh();
        onClose();
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Lỗi khi xác nhận vắng mặt'));
    } finally {
      setIsApprovingAbsentee(false);
    }
  };

  // Handle In-Place Edit Submit
  const handleSaveEdits = () => {
    if (!editReason.trim()) {
      alert('Vui lòng nhập lý do điều chỉnh kỹ thuật của Zone Admin!');
      return;
    }

    const diffs: DiffItem[] = [];
    const updates: Record<string, unknown> = {};

    const origDisplayCode = String(surveyJsonInit.displayCode || unitInfo?.display_code || unitInfo?.unit_code || '');
    if (editDisplayCode !== origDisplayCode) {
      diffs.push({ field: 'displayCode', label: 'Biển số căn hộ thực tế', oldValue: origDisplayCode, newValue: editDisplayCode });
      updates.displayCode = editDisplayCode;
    }

    const origArea = String(surveyJsonInit.unitAreaM2 ?? unitInfo?.unit_area_m2 ?? '');
    if (editUnitAreaM2 !== origArea) {
      diffs.push({ field: 'unitAreaM2', label: 'Diện tích căn hộ (m²)', oldValue: origArea, newValue: editUnitAreaM2 });
      updates.unitAreaM2 = editUnitAreaM2 ? Number(editUnitAreaM2) : '';
    }

    if (editOwnerName !== (unitInfo?.owner_name || data.ownerName || '')) {
      diffs.push({
        field: 'ownerName',
        label: 'Tên chủ hộ',
        oldValue: unitInfo?.owner_name || data.ownerName || '',
        newValue: editOwnerName,
      });
      updates.ownerName = editOwnerName;
    }

    if (editOwnerPhone !== (unitInfo?.owner_phone || data.ownerPhone || '')) {
      diffs.push({
        field: 'ownerPhone',
        label: 'Số điện thoại',
        oldValue: unitInfo?.owner_phone || data.ownerPhone || '',
        newValue: editOwnerPhone,
      });
      updates.ownerPhone = editOwnerPhone;
    }

    const origIdCard = String(surveyJsonInit.ownerIdCard || unitInfo?.owner_id_card || '');
    if (editOwnerIdCard !== origIdCard) {
      diffs.push({ field: 'ownerIdCard', label: 'CCCD / Định danh chủ hộ', oldValue: origIdCard, newValue: editOwnerIdCard });
      updates.ownerIdCard = editOwnerIdCard;
    }

    if (editResidentStatus !== (unitInfo?.resident_status || 'CHỦ_HỘ_Ở')) {
      diffs.push({
        field: 'residentStatus',
        label: 'Tình trạng cư trú',
        oldValue: unitInfo?.resident_status || 'CHỦ_HỘ_Ở',
        newValue: editResidentStatus,
      });
      updates.residentStatus = editResidentStatus;
    }

    const origJam = String(surveyJsonInit.doorJammingStatus || 'NORMAL');
    if (editDoorJammingStatus !== origJam) {
      diffs.push({ field: 'doorJammingStatus', label: 'Tình trạng đóng mở cửa', oldValue: origJam, newValue: editDoorJammingStatus });
      updates.doorJammingStatus = editDoorJammingStatus;
    }

    const origHasLeak = Boolean(surveyJsonInit.upperFloorWaterLeakage?.has);
    const origLeakDesc = String(surveyJsonInit.upperFloorWaterLeakage?.description || surveyJsonInit.upperFloorWaterLeakage?.leakageItems?.[0]?.description || '');
    if (editHasWaterLeak !== origHasLeak || editWaterLeakDesc !== origLeakDesc) {
      diffs.push({
        field: 'upperFloorWaterLeakage',
        label: 'Hiện tượng thấm dột trần',
        oldValue: origHasLeak ? origLeakDesc || 'Có thấm dột' : 'Không',
        newValue: editHasWaterLeak ? editWaterLeakDesc || 'Có thấm dột' : 'Không',
      });
      updates.upperFloorWaterLeakage = {
        ...(surveyJsonInit.upperFloorWaterLeakage || {}),
        has: editHasWaterLeak,
        description: editWaterLeakDesc,
        location: surveyJsonInit.upperFloorWaterLeakage?.location || 'Trần căn hộ',
      };
    }

    const origSagMm = String(surveyJsonInit.beamSagging?.sagMm ?? '');
    const origSpanM = String(surveyJsonInit.beamSagging?.spanM ?? '');
    if (editBeamSagMm !== origSagMm || editBeamSpanM !== origSpanM) {
      diffs.push({
        field: 'beamSagging',
        label: 'Độ võng dầm / bản sàn',
        oldValue: origSagMm ? `${origSagMm}mm / ${origSpanM}m` : 'Không',
        newValue: editBeamSagMm ? `${editBeamSagMm}mm / ${editBeamSpanM}m` : 'Không',
      });
      updates.beamSagging = {
        ...(surveyJsonInit.beamSagging || {}),
        hasSagging: Number(editBeamSagMm) > 0,
        sagMm: editBeamSagMm ? Number(editBeamSagMm) : 0,
        spanM: editBeamSpanM ? Number(editBeamSpanM) : 0,
      };
    }

    const origSummary = String(surveyJsonInit.summaryConclusions || data.summaryConclusions || '');
    if (editSummaryConclusions !== origSummary) {
      diffs.push({ field: 'summaryConclusions', label: 'Kết luận tổng hợp căn hộ', oldValue: origSummary, newValue: editSummaryConclusions });
      updates.summaryConclusions = editSummaryConclusions;
    }

    if (editEngineeringRecs !== (data.engineeringRecommendations || '')) {
      diffs.push({
        field: 'engineeringRecommendations',
        label: 'Khuyến nghị kỹ thuật',
        oldValue: data.engineeringRecommendations || '',
        newValue: editEngineeringRecs,
      });
      updates.engineeringRecommendations = editEngineeringRecs;
    }

    const origFeedback = String(surveyJsonInit.ownerFeedback || surveyJsonInit.ownerRemarks || '');
    if (editOwnerFeedback !== origFeedback) {
      diffs.push({ field: 'ownerFeedback', label: 'Ý kiến chủ hộ', oldValue: origFeedback, newValue: editOwnerFeedback });
      updates.ownerFeedback = editOwnerFeedback;
    }

    if (diffs.length === 0) {
      alert('Chưa có thông tin nào được thay đổi.');
      return;
    }

    updates.editReason = editReason;
    onOpenDiffModal(diffs, updates);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* 1. Header Banner & Warning Flags */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  CĂN HỘ CON CHUNG CƯ
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {unitInfo?.display_code || unitInfo?.unit_code || 'Căn hộ'} • Tầng {unitInfo?.floor_number || '?'}
                </h2>
                {isApproved && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã Phê Duyệt
                  </span>
                )}
                {isAbsentVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Xác Nhận Vắng Mặt
                  </span>
                )}
                {isAbsent && !isAbsentVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> Vắng Chủ Hộ (Chờ Xác Nhận)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>Tòa nhà mẹ: <strong className="text-slate-800">{parentBuilding?.projectParcelCode || data.projectParcelCode}</strong></span>
                <span>•</span>
                <span>Địa chỉ: {parentBuilding?.houseNumber || data.houseNumber} {parentBuilding?.street || data.street}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isEditing
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Đóng chế độ sửa' : 'Điều chỉnh Admin'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenEngineeringJudgement}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phán đoán chuyên gia</span>
            </button>
          </div>
        </div>

        {/* Warning Flags */}
        {auditFlags.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Cờ Cảnh Báo Thẩm Định ({auditFlags.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {auditFlags.map((flag, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    flag.level === 'WARNING'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-sky-50/80 border-sky-200 text-sky-900'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${flag.level === 'WARNING' ? 'text-amber-600' : 'text-sky-600'}`} />
                  <div>
                    <span className="font-bold">{flag.code}: </span>
                    <span>{flag.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* In-Place Edit Panel */}
      {isEditing && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-amber-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>Zone Admin Điều Chỉnh Trực Tiếp (In-Place Edit)</span>
            </h4>
            <span className="text-[11px] text-amber-700">Mọi thay đổi sẽ được ghi nhật ký kiểm toán</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Biển số phòng thực tế</label>
              <input
                type="text"
                value={editDisplayCode}
                onChange={(e) => setEditDisplayCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Diện tích căn hộ (m²)</label>
              <input
                type="number"
                step="0.1"
                value={editUnitAreaM2}
                onChange={(e) => setEditUnitAreaM2(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">CCCD / Định danh chủ hộ</label>
              <input
                type="text"
                value={editOwnerIdCard}
                onChange={(e) => setEditOwnerIdCard(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Tên chủ hộ</label>
              <input
                type="text"
                value={editOwnerName}
                onChange={(e) => setEditOwnerName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Số điện thoại</label>
              <input
                type="text"
                value={editOwnerPhone}
                onChange={(e) => setEditOwnerPhone(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Tình trạng cư trú</label>
              <select
                value={editResidentStatus}
                onChange={(e) => setEditResidentStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              >
                <option value="CHỦ_HỘ_Ở">Chủ hộ ở trực tiếp</option>
                <option value="CHO_THUÊ">Cho thuê</option>
                <option value="ĐỂ_TRỐNG">Để trống</option>
                <option value="TRANH_CHẤP">Tranh chấp / Khiếu nại</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Tình trạng đóng mở cửa</label>
              <select
                value={editDoorJammingStatus}
                onChange={(e) => setEditDoorJammingStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              >
                <option value="NORMAL">Bình thường</option>
                <option value="JAMMED">Bị kẹt cánh / khó đóng mở</option>
                <option value="RUBBING_FLOOR">Xệ cánh cạ sàn</option>
                <option value="CRACKED_GLASS">Nứt rạn kính cửa</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Độ võng dầm/sàn f (mm) & Nhịp L (m)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  value={editBeamSagMm}
                  onChange={(e) => setEditBeamSagMm(e.target.value)}
                  placeholder="f (mm)"
                  className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  value={editBeamSpanM}
                  onChange={(e) => setEditBeamSpanM(e.target.value)}
                  placeholder="L (m)"
                  className="w-1/2 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                <input
                  type="checkbox"
                  checked={editHasWaterLeak}
                  onChange={(e) => setEditHasWaterLeak(e.target.checked)}
                />
                <span>Thấm dột trần lầu trên</span>
              </label>
              <input
                type="text"
                value={editWaterLeakDesc}
                onChange={(e) => setEditWaterLeakDesc(e.target.value)}
                placeholder="Mô tả vị trí / tình trạng thấm dột..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Kết luận tổng hợp căn hộ</label>
              <input
                type="text"
                value={editSummaryConclusions}
                onChange={(e) => setEditSummaryConclusions(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                placeholder="Kết luận hiện trạng căn hộ..."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Khuyến nghị kỹ thuật của Admin</label>
              <input
                type="text"
                value={editEngineeringRecs}
                onChange={(e) => setEditEngineeringRecs(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                placeholder="VD: Cần theo dõi thêm nứt trần tiếp giáp WC tầng trên..."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Ý kiến chủ hộ</label>
              <input
                type="text"
                value={editOwnerFeedback}
                onChange={(e) => setEditOwnerFeedback(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                placeholder="Ý kiến ghi nhận từ chủ sở hữu căn hộ..."
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-amber-900 block mb-1">
              Lý do kỹ thuật điều chỉnh (Bắt buộc) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Nhập giải trình lý do sửa đổi số liệu..."
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveEdits}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Điều Chỉnh</span>
            </button>
          </div>
        </div>
      )}

      {/* Block 1: Thừa hưởng & Định danh ảnh P-01 / P-04 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Camera className="w-4 h-4 text-indigo-600" />
          <span>Khối 1: Định Danh Căn Hộ & Ảnh Nhận Diện Hiện Trường</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ảnh P-01: Cửa vào căn hộ */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">P-01: Biển Số Nhà / Cửa Căn Hộ</span>
              {p01Url && (
                <button
                  type="button"
                  onClick={() => onOpenPhotoZoom(p01Url, 'P-01: Biển Số Căn Hộ', 'P-01')}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" /> Phóng to
                </button>
              )}
            </div>
            {p01Url ? (
              <div
                onClick={() => onOpenPhotoZoom(p01Url, 'P-01: Biển Số Căn Hộ', 'P-01')}
                className="relative aspect-4/3 bg-slate-900 rounded-lg overflow-hidden cursor-pointer group"
              >
                <img src={p01Url} alt="P-01" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                  <Eye className="w-4 h-4 mr-1" /> Click để xem chi tiết
                </div>
              </div>
            ) : (
              <div className="aspect-4/3 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs">
                <Camera className="w-6 h-6 mb-1 opacity-50" />
                <span>Chưa có ảnh P-01</span>
              </div>
            )}
          </div>

          {/* Ảnh P-04: Ngữ cảnh hành lang */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">P-04: Ngữ Cảnh Hành Lang Tầng</span>
              {p04Url && (
                <button
                  type="button"
                  onClick={() => onOpenPhotoZoom(p04Url, 'P-04: Hành Lang Tầng', 'P-04')}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" /> Phóng to
                </button>
              )}
            </div>
            {p04Url ? (
              <div
                onClick={() => onOpenPhotoZoom(p04Url, 'P-04: Hành Lang Tầng', 'P-04')}
                className="relative aspect-4/3 bg-slate-900 rounded-lg overflow-hidden cursor-pointer group"
              >
                <img src={p04Url} alt="P-04" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                  <Eye className="w-4 h-4 mr-1" /> Click để xem chi tiết
                </div>
              </div>
            ) : (
              <div className="aspect-4/3 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs">
                <Camera className="w-6 h-6 mb-1 opacity-50" />
                <span>Chưa có ảnh P-04</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block 2: Chủ hộ & Pháp lý / Ca Vắng Mặt */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          <span>Khối 2: Thông Tin Chủ Hộ & Xác Thực Pháp Lý</span>
        </h3>

        {isAbsent ? (
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-700" />
                <span>Ca Khảo Sát Vắng Mặt (Chủ hộ vắng nhà / Không tiếp cận)</span>
              </span>
              <span className="text-xs font-mono font-bold text-purple-700">Quy trình 1 lần dán giấy mời</span>
            </div>

            <p className="text-xs text-purple-900 leading-relaxed">
              Theo quy chuẩn khảo sát chung cư, KSV đã thực hiện ghi nhận vắng mặt kèm ảnh dán giấy hẹn/giấy mời tại cửa căn hộ.
              Zone Admin kiểm tra bằng chứng hình ảnh và xác nhận vắng mặt hợp lệ để chuyển trạng thái sang <strong>POSTPONED_ABSENT_VERIFIED</strong>.
            </p>

            {/* Ảnh dán giấy mời nếu có */}
            {p01Url && (
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-purple-200">
                <img src={p01Url} alt="Giấy mời" className="w-16 h-16 object-cover rounded-md cursor-pointer" onClick={() => onOpenPhotoZoom(p01Url, 'Ảnh Giấy Mời Tại Cửa', 'ABSENT_NOTICE')} />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Bằng chứng dán giấy hẹn khảo sát</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">Ảnh chụp hiện trường cửa căn hộ</div>
                </div>
              </div>
            )}

            {!isAbsentVerified && (
              <div className="pt-2">
                {!showAbsenteeConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowAbsenteeConfirm(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác Nhận Vắng Mặt Hợp Lệ (Approve Absentee)</span>
                  </button>
                ) : (
                  <div className="bg-white p-3 rounded-xl border border-purple-300 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 block">Ghi chú xác nhận của Zone Admin (tùy chọn)</label>
                    <input
                      type="text"
                      value={absenteeNotes}
                      onChange={(e) => setAbsenteeNotes(e.target.value)}
                      placeholder="VD: Đã đối chiếu ảnh giấy mời hợp lệ, đủ điều kiện đưa vào hồ sơ vắng mặt"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAbsenteeConfirm(false)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isApprovingAbsentee}
                        onClick={handleApproveAbsentee}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isApprovingAbsentee ? 'Đang xác nhận...' : 'Xác nhận ngay'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Tên chủ hộ:</span>
              <strong className="text-slate-800 text-sm">{unitInfo?.owner_name || data.ownerName || 'Chưa cập nhật'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Số điện thoại:</span>
              <strong className="text-slate-800 text-sm">{unitInfo?.owner_phone || data.ownerPhone || 'Chưa cập nhật'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Tình trạng cư trú:</span>
              <strong className="text-indigo-700 text-sm">{unitInfo?.resident_status || 'CHỦ_HỘ_Ở'}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Block 3: Hiện trạng hư hỏng & CAD Pinning */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Khối 3: Khảo Sát Hiện Trạng Khuyết Tật Căn Hộ ({damageZones.length} Không Gian)</span>
          </h3>

          {Boolean(surveyJson.waterLeakageFromUpperFloor) && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
              <Droplet className="w-3.5 h-3.5 text-sky-600" /> Thấm dột từ tầng trên
            </span>
          )}
        </div>

        {/* CAD Floor Blueprint nếu có */}
        {floorPlan?.cad_photo_url && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Bản Vẽ Mặt Bằng Tầng {floorPlan.floor_number}</span>
              <button
                type="button"
                onClick={() => onOpenPhotoZoom(floorPlan.cad_photo_url!, `Mặt Bằng Tầng ${floorPlan.floor_number}`)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" /> Phóng to bản vẽ
              </button>
            </div>
            <img
              src={floorPlan.cad_photo_url}
              alt="Mặt bằng"
              className="w-full max-h-64 object-contain rounded-lg bg-white border border-slate-200 cursor-pointer"
              onClick={() => onOpenPhotoZoom(floorPlan.cad_photo_url!, `Mặt Bằng Tầng ${floorPlan.floor_number}`)}
            />
          </div>
        )}

        {/* Danh sách các không gian & vết nứt */}
        {damageZones.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Căn hộ không ghi nhận khuyết tật nứt hư hỏng nào (Grade 0).
          </div>
        ) : (
          <div className="space-y-4">
            {damageZones.map((zone, zIdx) => {
              const defects = zone.defects || [];
              return (
                <div key={zIdx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {zone.zone_code || `K-${zIdx + 1}`}
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {zone.room_name || 'Không gian căn hộ'} • {zone.component_type || 'Tường'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {defects.length} vết nứt
                    </span>
                  </div>

                  {/* Ảnh bối cảnh (CTX) */}
                  {zone.ctx_photo_url && (
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                      <img
                        src={zone.ctx_photo_url}
                        alt="CTX"
                        className="w-16 h-16 object-cover rounded-md cursor-pointer hover:opacity-80"
                        onClick={() => onOpenPhotoZoom(zone.ctx_photo_url!, `Ảnh Bối Cảnh: ${zone.room_name || ''}`, zone.zone_code)}
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-700">Ảnh Bối Cảnh Không Gian (CTX)</div>
                        <div className="text-slate-400 text-[11px]">Click để phóng to chi tiết</div>
                      </div>
                    </div>
                  )}

                  {/* Danh sách điểm nứt D */}
                  {defects.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {defects.map((d, dIdx) => {
                        const cuPhoto = d.cuPhotoUrl || d.cu_photo_url || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : null);
                        const hasScale = Boolean(d.hasScaleCard ?? d.has_scale_card);
                        const isCrit = Boolean(d.isStructuralCritical ?? d.is_structural_critical);

                        return (
                          <div key={dIdx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-3 shadow-2xs">
                            {cuPhoto ? (
                              <img
                                src={cuPhoto}
                                alt="CU"
                                className="w-16 h-16 object-cover rounded-lg shrink-0 cursor-pointer hover:opacity-80"
                                onClick={() => onOpenPhotoZoom(cuPhoto, `Ảnh Cận Cảnh Vết Nứt ${d.defectCode || d.defect_code}`, d.defectCode || d.defect_code)}
                              />
                            ) : (
                              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                                Không ảnh
                              </div>
                            )}

                            <div className="text-xs space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-slate-800">
                                  {d.defectCode || d.defect_code || `D-${dIdx + 1}`}
                                </span>
                                {isCrit ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-300">
                                    Kết cấu
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    Thứ yếu
                                  </span>
                                )}
                              </div>

                              <div className="text-slate-600 text-[11px]">
                                Rộng: <strong>{d.widthMaxMm ?? d.width_max_mm ?? 0}mm</strong> • Dài: <strong>{d.lengthMm ?? d.length_mm ?? 0}mm</strong>
                              </div>

                              <div className="pt-0.5">
                                {hasScale ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Có thước đo tỉ lệ
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Thiếu thước đo (Warning)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Block 4: Quyết định Phê Duyệt Của Zone Admin */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-slate-900">Quyết Định Thẩm Định Căn Hộ</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Zone Admin kiểm tra đối soát và ký duyệt một chạm (tự động lưu ID, timestamp và khóa bất biến).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenRejectModal}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Trả Về (Reject)</span>
          </button>

          {!isApproved && (
            <button
              type="button"
              disabled={isApproving || isMissingRealOwnerName}
              onClick={handleApprove}
              title={
                isMissingRealOwnerName
                  ? 'Căn hộ thiếu tên chủ hộ thực tế. Vui lòng bấm Trả về (Reject) để KSV bổ sung!'
                  : undefined
              }
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Đang duyệt...' : 'Phê Duyệt Căn Hộ (Approve)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
