import React, { useState } from 'react';
import {
  Landmark,
  Building,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Camera,
  Maximize2,
  Edit3,
  Save,
  ShieldAlert,
  Sparkles,
  Columns,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
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

export const CondoMasterAreaAuditStudioView: React.FC<Props> = ({
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
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(data.engineeringRecommendations || '');
  const [editReason, setEditReason] = useState('');

  const surveyJson = data.surveyJson || data.survey_data_json || {};
  const unitInfo = data.unitInfo;
  const parentBuilding = data.parentBuildingInfo;
  const floorPlan = data.floorPlanInfo;
  const auditFlags = data.auditWarningFlags || [];

  const isApproved = data.status === 'APPROVED' || unitInfo?.status === 'APPROVED';

  // Extract structural elements & damage zones
  const damageZones = (data.leftPane?.damageZones || surveyJson.zones || []) as Array<{
    id?: string;
    zone_code?: string;
    room_name?: string;
    component_type?: string;
    ctx_photo_url?: string;
    burland_grade?: number;
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

  const structuralElements = (data.leftPane?.structuralElements || surveyJson.structuralElements || []) as Array<{
    id?: string;
    zone_code?: string;
    element_code?: string;
    element_type?: string;
    material_type?: string;
    ctx_photo_url?: string;
    defects?: unknown[];
  }>;

  // Handle Approve
  const handleApprove = async () => {
    if (!window.confirm(`Xác nhận phê duyệt thẩm định Khu vực dùng chung ${unitInfo?.display_code || unitInfo?.unit_code || data.projectParcelCode}?`)) {
      return;
    }
    setIsApproving(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/approve`, {});
      if (res.data?.success || res.status === 200) {
        alert('Phê duyệt khu vực dùng chung thành công!');
        onRefresh();
        onClose();
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Lỗi khi phê duyệt'));
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Save In-place edit
  const handleSaveEdits = () => {
    if (!editReason.trim()) {
      alert('Vui lòng nhập lý do kỹ thuật của Admin!');
      return;
    }
    const diffs: DiffItem[] = [
      {
        field: 'engineeringRecommendations',
        label: 'Khuyến nghị thẩm định',
        oldValue: data.engineeringRecommendations || '',
        newValue: editNotes,
      },
    ];
    onOpenDiffModal(diffs, {
      engineeringRecommendations: editNotes,
      editReason,
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* 1. Header Banner & Warning Flags */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-teal-100 text-teal-800 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  KHU VỰC DÙNG CHUNG (MASTER AREA)
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {unitInfo?.display_code || unitInfo?.unit_code || 'M-Area'} • Tầng {unitInfo?.floor_number ?? 'Dùng chung'}
                </h2>
                {isApproved && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã Phê Duyệt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>Tòa nhà: <strong className="text-slate-800">{parentBuilding?.projectParcelCode || data.projectParcelCode}</strong></span>
                <span>•</span>
                <span>Địa chỉ: {parentBuilding?.houseNumber || data.houseNumber} {parentBuilding?.street || data.street}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Đóng chế độ sửa' : 'Điều chỉnh Admin'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenEngineeringJudgement}
              className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phán đoán chuyên gia</span>
            </button>
          </div>
        </div>

        {/* Cờ cảnh báo */}
        {auditFlags.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Cờ Cảnh Báo Thẩm Định ({auditFlags.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {auditFlags.map((flag, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border text-xs flex items-start gap-2 bg-amber-50/80 border-amber-200 text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
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

      {/* In-Place Edit Drawer */}
      {isEditing && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3 animate-in fade-in">
          <h4 className="text-sm font-black text-amber-900 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            <span>Điều Chỉnh Khuyến Nghị Khu Vực Dùng Chung</span>
          </h4>
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Khuyến nghị kỹ thuật của Admin</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-amber-900 block mb-1">Lý do điều chỉnh (Bắt buộc)</label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Nhập giải trình lý do điều chỉnh..."
              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs"
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
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu</span>
            </button>
          </div>
        </div>
      )}

      {/* Block 1: Nhận diện Khu Vực Dùng Chung */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Camera className="w-4 h-4 text-teal-600" />
          <span>Khối 1: Bối Cảnh & Nhận Diện Khu Vực Dùng Chung</span>
        </h3>

        {floorPlan?.cad_photo_url && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Mặt Bằng Tầng {floorPlan.floor_number}</span>
              <button
                type="button"
                onClick={() => onOpenPhotoZoom(floorPlan.cad_photo_url!, `Mặt Bằng Tầng ${floorPlan.floor_number}`)}
                className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" /> Phóng to mặt bằng
              </button>
            </div>
            <img
              src={floorPlan.cad_photo_url}
              alt="Mặt bằng"
              className="w-full max-h-56 object-contain rounded-lg bg-white border border-slate-200 cursor-pointer"
              onClick={() => onOpenPhotoZoom(floorPlan.cad_photo_url!, `Mặt Bằng Tầng ${floorPlan.floor_number}`)}
            />
          </div>
        )}
      </div>

      {/* Block 2: Cấu kiện chịu lực kết cấu trọng yếu */}
      {structuralElements.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Columns className="w-4 h-4 text-teal-600" />
            <span>Khối 2: Cấu Kiện Chịu Lực Trọng Yếu ({structuralElements.length} Cấu kiện E)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {structuralElements.map((elem, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                {elem.ctx_photo_url ? (
                  <img
                    src={elem.ctx_photo_url}
                    alt="Element"
                    className="w-14 h-14 object-cover rounded-lg shrink-0 cursor-pointer"
                    onClick={() => onOpenPhotoZoom(elem.ctx_photo_url!, `Cấu kiện ${elem.element_code || elem.zone_code}`)}
                  />
                ) : (
                  <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                    No photo
                  </div>
                )}
                <div className="text-xs">
                  <div className="font-mono font-bold text-slate-800">{elem.element_code || elem.zone_code || `E-${idx + 1}`}</div>
                  <div className="text-slate-600">{elem.element_type || 'Cột BTCT / Dầm chuyển'}</div>
                  <div className="text-slate-400 text-[11px]">Vật liệu: {elem.material_type || 'BTCT'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block 3: Hiện trạng khuyết tật & vết nứt */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Khối 3: Khảo Sát Hiện Trạng Khuyết Tật ({damageZones.length} Vùng Khảo Sát)</span>
        </h3>

        {damageZones.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Khu vực dùng chung không có khuyết tật hư hỏng (Grade 0).
          </div>
        ) : (
          <div className="space-y-4">
            {damageZones.map((zone, zIdx) => {
              const defects = zone.defects || [];
              return (
                <div key={zIdx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      {zone.zone_code || `Z-${zIdx + 1}`} • {zone.room_name || 'Khu vực'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {defects.length} vết nứt
                    </span>
                  </div>

                  {zone.ctx_photo_url && (
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200">
                      <img
                        src={zone.ctx_photo_url}
                        alt="CTX"
                        className="w-14 h-14 object-cover rounded-md cursor-pointer"
                        onClick={() => onOpenPhotoZoom(zone.ctx_photo_url!, `Ảnh Bối Cảnh ${zone.zone_code}`)}
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700">Ảnh Bối Cảnh (CTX)</span>
                        <div className="text-[11px] text-slate-400">Click xem toàn cảnh</div>
                      </div>
                    </div>
                  )}

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
                                className="w-14 h-14 object-cover rounded-lg shrink-0 cursor-pointer"
                                onClick={() => onOpenPhotoZoom(cuPhoto, `Vết nứt ${d.defectCode || d.defect_code}`)}
                              />
                            ) : (
                              <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                                Không ảnh
                              </div>
                            )}

                            <div className="text-xs space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-slate-800">{d.defectCode || d.defect_code || `D-${dIdx + 1}`}</span>
                                {isCrit && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">Kết cấu</span>}
                              </div>
                              <div className="text-slate-600 text-[11px]">
                                Rộng: <strong>{d.widthMaxMm ?? d.width_max_mm ?? 0}mm</strong> • Dài: <strong>{d.lengthMm ?? d.length_mm ?? 0}mm</strong>
                              </div>
                              <div className="pt-0.5">
                                {hasScale ? (
                                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" /> Thước đo tỉ lệ chuẩn
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 flex items-center gap-1 font-bold">
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

      {/* Block 4: Quyết Định Thẩm Định */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-slate-900">Quyết Định Thẩm Định Khu Vực Dùng Chung</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Zone Admin kiểm tra đối soát cấu kiện và cấp duyệt một chạm.
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
              disabled={isApproving}
              onClick={handleApprove}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Đang duyệt...' : 'Phê Duyệt Khu Vực (Approve)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
