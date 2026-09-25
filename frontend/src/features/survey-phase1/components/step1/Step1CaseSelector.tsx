import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Button } from '../../../../core/components/ui/Button';
import { Input, Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import {
  Building2,
  Home,
  DoorClosed,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Send,
} from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';
import { ABSENTEE_REASONS } from './step1.constants';

interface Step1CaseSelectorProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  currentCase: 'NORMAL' | 'ABSENTEE' | 'APARTMENT' | 'UNDER_CONSTRUCTION';
  onSelectCase: (caseType: 'NORMAL' | 'ABSENTEE' | 'APARTMENT' | 'UNDER_CONSTRUCTION') => void;
  isCondoMaster?: boolean;
  completeness: {
    hasAddress: boolean;
    hasObjectGroup: boolean;
    hasAdjacent: boolean;
    hasPhotos: boolean;
    isFullyComplete: boolean;
  };
  isSubmittingAbsentee: boolean;
  onSubmitAbsentee: () => void;
  isConfirmingApartment: boolean;
  onConfirmApartment: () => void;
  isSubmittingUnderConstruction: boolean;
  onSubmitUnderConstruction: () => void;
}

export const Step1CaseSelector: React.FC<Step1CaseSelectorProps> = ({
  formData,
  updateFormData,
  currentCase,
  onSelectCase,
  isCondoMaster,
  completeness,
  isSubmittingAbsentee,
  onSubmitAbsentee,
  isConfirmingApartment,
  onConfirmApartment,
  isSubmittingUnderConstruction,
  onSubmitUnderConstruction,
}) => {
  if (isCondoMaster) return null;

  return (
    <Card className="border-emerald-300 bg-emerald-50/30 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-700" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.7. Nhận Định Loại Công Trình
            </h2>
            <p className="text-xs text-slate-600">
              Lựa chọn phương thức khảo sát phù hợp với tình trạng thực tế của công trình
            </p>
          </div>
        </div>
      </div>

      {/* 4 Lựa chọn trường hợp */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option 1: Nhà dân thông thường */}
        <div
          onClick={() => onSelectCase('NORMAL')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            currentCase === 'NORMAL'
              ? 'bg-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Home className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-800">
              1. Nhà dân / Công trình thông thường
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-9">
            Chủ hộ có mặt tại nhà, tiếp tục khảo sát toàn diện 9 bước (Phỏng vấn, Tầng, Vùng Z/E, Tính điểm).
          </p>
        </div>

        {/* Option 2: Vắng nhà */}
        <div
          onClick={() => onSelectCase('ABSENTEE')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            currentCase === 'ABSENTEE'
              ? 'bg-amber-50/90 border-amber-600 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
              <DoorClosed className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-amber-950">
              2. Vắng nhà / Không thể vào trong (Báo vắng)
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-9">
            Chủ nhà khóa cửa ngoài hoặc đi vắng, nộp biên bản vắng nhà & hoàn tất hồ sơ ngoại quan Bước 1.
          </p>
        </div>

        {/* Option 3: Chung cư */}
        <div
          onClick={() => onSelectCase('APARTMENT')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            currentCase === 'APARTMENT'
              ? 'bg-blue-50/90 border-blue-600 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-blue-950">
              3. Chung cư / Tòa nhà nhiều căn hộ
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-9">
            Khảo sát các vùng dùng chung (Hầm, Mái, Sảnh, Trục kỹ thuật). Các căn hộ con sẽ khảo sát riêng.
          </p>
        </div>

        {/* Option 4: Nhà đang xây */}
        <div
          onClick={() => onSelectCase('UNDER_CONSTRUCTION')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            currentCase === 'UNDER_CONSTRUCTION'
              ? 'bg-orange-50/90 border-orange-600 shadow-sm ring-2 ring-orange-500/20'
              : 'bg-white/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-800">
              <HardHat className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-orange-950">
              4. Nhà đang xây dựng / Đang thi công
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-9">
            Ghi nhận ảnh hiện trạng tiến độ xây thô, móng, giàn giáo và hoàn tất hồ sơ khảo sát công trình dở dang.
          </p>
        </div>
      </div>

      {/* 1. Chi tiết Option VẮNG NHÀ */}
      {currentCase === 'ABSENTEE' && (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm pb-2 border-b border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Hồ Sơ Xác Nhận Vắng Nhà & Tiến Độ Ngoại Quan</span>
          </div>

          {/* Checklist hoàn thiện Bước 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
              <span>1. Số nhà & Địa chỉ định danh</span>
              {completeness.hasAddress ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-700 font-bold">Chưa đủ</span>
              )}
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
              <span>2. Nhóm đối tượng công trình</span>
              {completeness.hasObjectGroup ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-700 font-bold">Chưa chọn</span>
              )}
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
              <span>3. Hiện trạng tiếp giáp 3 hướng</span>
              {completeness.hasAdjacent ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-700 font-bold">Chưa đủ</span>
              )}
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
              <span>4. Bộ 4 ảnh ngoại quan (P01 - P04)</span>
              {completeness.hasPhotos ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-700 font-bold">Chưa chụp đủ</span>
              )}
            </div>
          </div>

          <Select
            id="input-absenteeReason"
            label="Lý do vắng mặt / không tiếp cận: *"
            value={formData.absenteeReason || ''}
            onChange={(e) => updateFormData({ absenteeReason: e.target.value })}
            options={[
              { value: '', label: '-- Chọn lý do vắng mặt / không tiếp cận --' },
              ...ABSENTEE_REASONS.map((r) => ({ value: r, label: r })),
            ]}
          />

          {formData.absenteeReason === 'Lý do khác' && (
            <Input
              label="Chi tiết lý do vắng mặt khác *"
              placeholder="Nhập lý do cụ thể (VD: Gia đình đi định cư nước ngoài, nhà đang niêm phong tranh chấp...)"
              value={formData.customAbsenteeReason || ''}
              onChange={(e) => updateFormData({ customAbsenteeReason: e.target.value })}
            />
          )}

          {/* Tải lên nhiều ảnh biên bản vắng nhà */}
          <div id="absentee-minutes-section" className="space-y-2 pt-2 border-t border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-700" />
                Ảnh Chụp Biên Bản Vắng Nhà (Bắt buộc tối thiểu 1 ảnh) *:
              </span>
              <span className="text-[11px] text-slate-500">
                Đã tải: {formData.absenteeMinutesPhotos?.length || 0} ảnh
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {formData.absenteeMinutesPhotos?.map((photoUrl, pIdx) => (
                <div
                  key={pIdx}
                  className="relative rounded-lg overflow-hidden border border-amber-300 aspect-video group"
                >
                  <img src={photoUrl} alt={`Absentee Minutes ${pIdx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = formData.absenteeMinutesPhotos?.filter((_, i) => i !== pIdx) || [];
                      updateFormData({ absenteeMinutesPhotos: updated });
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <PhotoCaptureInput
                label="Thêm ảnh biên bản vắng"
                value=""
                onChange={(url) => {
                  if (url) {
                    const updated = [...(formData.absenteeMinutesPhotos || []), url];
                    updateFormData({ absenteeMinutesPhotos: updated });
                  }
                }}
                watermarkText={`BIEN-BAN-VANG | ${formData.houseNumber || 'ABSENTEE'}`}
                height="85px"
              />
            </div>
          </div>

          {/* Nút nộp hồ sơ vắng */}
          <div className="pt-3 border-t border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-amber-900 flex items-center gap-1.5 font-medium">
              {completeness.isFullyComplete ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600 inline shrink-0" />
                  <span>Đã hoàn thành 100% dữ liệu ngoại quan Bước 1. Sẵn sàng nộp hồ sơ vắng.</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-amber-600 inline shrink-0" />
                  <span>Vui lòng hoàn thành đủ các trường thông tin Bước 1 để nộp hồ sơ.</span>
                </>
              )}
            </span>
            <Button
              variant="danger"
              size="lg"
              disabled={!completeness.isFullyComplete || isSubmittingAbsentee}
              onClick={onSubmitAbsentee}
              icon={<Send className="w-4 h-4" />}
            >
              {isSubmittingAbsentee ? 'Đang gửi hồ sơ vắng...' : 'Xác Nhận & Nộp Hồ Sơ Vắng Nhà'}
            </Button>
          </div>
        </div>
      )}

      {/* 2. Chi tiết Option CHUNG CƯ */}
      {currentCase === 'APARTMENT' && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>Quy Chuẩn Khảo Sát Tòa Nhà Chung Cư / Hỗn Hợp</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            • Hệ thống đã tự động thiết lập <strong>Nhóm đối tượng = Important (2đ)</strong>.<br />
            • Khảo sát tập trung vào các <strong>Không gian & Kết cấu dùng chung</strong>: Tầng hầm để xe, Mái/Sân thượng, Sảnh đón, Thang bộ/Thang máy, Trục kỹ thuật chung.<br />
            • <strong>Các căn hộ con trong toà:</strong> Được quản lý độc lập theo danh sách căn hộ (Building Units) trong Hub Chung Cư và sẽ được khảo sát riêng từng căn.
          </p>
          <div className="pt-2 flex justify-end">
            <Button
              size="md"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isConfirmingApartment}
              onClick={onConfirmApartment}
              icon={<Building2 className="w-4 h-4" />}
            >
              {isConfirmingApartment ? 'Đang gửi xác nhận...' : 'Xác nhận Chung cư/Toàn nhiều căn hộ'}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Chi tiết Option NHÀ ĐANG XÂY DỰNG */}
      {currentCase === 'UNDER_CONSTRUCTION' && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-orange-950 font-bold text-sm pb-2 border-b border-orange-200">
            <HardHat className="w-4 h-4 text-orange-700" />
            <span>Ghi Nhận Hiện Trạng Công Trình Đang Thi Công Xây Dựng</span>
          </div>

          <div id="under-construction-photos-section" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-950">
                Ảnh Chụp Hiện Trạng Công Trình Đang Thi Công (Bắt buộc tối thiểu 1 ảnh) *:
              </span>
              <span className="text-[11px] text-slate-500">
                Đã chụp: {formData.underConstructionPhotos?.length || 0} ảnh
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {formData.underConstructionPhotos?.map((photoUrl, pIdx) => (
                <div
                  key={pIdx}
                  className="relative rounded-lg overflow-hidden border border-orange-300 aspect-video group"
                >
                  <img src={photoUrl} alt={`Construction ${pIdx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = formData.underConstructionPhotos?.filter((_, i) => i !== pIdx) || [];
                      updateFormData({ underConstructionPhotos: updated });
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <PhotoCaptureInput
                label="Thêm ảnh công trình"
                value=""
                onChange={(url) => {
                  if (url) {
                    const updated = [...(formData.underConstructionPhotos || []), url];
                    updateFormData({ underConstructionPhotos: updated });
                  }
                }}
                watermarkText={`CONSTRUCTION | ${formData.houseNumber || 'BUILDING'}`}
                height="85px"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú giai đoạn thi công hiện tại *:
            </label>
            <textarea
              id="input-constructionStageNotes"
              rows={2}
              placeholder="VD: Đang đào hố móng, đang ghép coffa đổ sàn tầng 2, đã xong phần thô đang hoàn thiện..."
              className="w-full px-2.5 py-1.5 bg-white border border-orange-300 rounded-lg text-xs focus:ring-1 focus:ring-orange-500"
              value={formData.constructionStageNotes || ''}
              onChange={(e) => updateFormData({ constructionStageNotes: e.target.value })}
            />
          </div>

          <div className="pt-3 border-t border-orange-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-orange-900">
              Ghi nhận hiện trạng ngoại quan công trình xây dựng để làm cơ sở pháp lý trước khi Metro đào hầm.
            </span>
            <Button
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={isSubmittingUnderConstruction}
              onClick={onSubmitUnderConstruction}
              icon={<Send className="w-4 h-4" />}
            >
              {isSubmittingUnderConstruction ? 'Đang gửi hồ sơ...' : 'Hoàn Tất Hồ Sơ Nhà Đang Xây'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
