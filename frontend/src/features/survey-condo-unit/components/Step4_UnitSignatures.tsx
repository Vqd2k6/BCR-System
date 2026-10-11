import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../components/common/TapToZoomThumbnail';
import {
  FileCheck,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Camera,
  Trash2,
  Layers,
  Building,
  Activity,
  Check,
} from 'lucide-react';

import { validateCondoUnitFull } from '../utils/condoUnitValidator';

interface Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
}

export const Step4_UnitSignatures: React.FC<Props> = ({ onSubmitFinal, isSubmitting }) => {
  const { formData, updateFormData, prevStep, isReadOnly } = useCondoUnitSurveyStore();
  const validation = validateCondoUnitFull(formData);

  const bCode = formData.parentInfo?.projectParcelCode || 'GENERAL';
  const fNum = Number(formData.floorNumber);
  const floorCode = isNaN(fNum)
    ? String(formData.floorNumber || 'F01')
    : fNum < 0
      ? `B${String(Math.abs(fNum)).padStart(2, '0')}`
      : fNum === 0
        ? 'G'
        : `F${String(fNum).padStart(2, '0')}`;

  const unitLabel = formData.displayCode || formData.unitCode || '---';

  const zones = formData.zones || [];
  const structuralElements = formData.structuralElements || [];
  const hasStructuralElements = formData.hasStructuralElements !== false;

  const allDefects = [
    ...zones.flatMap((z) => z.defects || []),
    ...structuralElements.flatMap((e) => e.defects || []),
  ];

  const burlandGrades = allDefects.map((d) => Number(d.burlandGrade) || 0);
  const maxBurlandGrade = burlandGrades.length > 0 ? Math.max(...burlandGrades) : 0;
  const criticalDefectCount = allDefects.filter((d) => (Number(d.widthMaxMm) || 0) >= 2.0).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 4.1. Bảng Đối Soát Tổng Thể Dữ Liệu Khảo Sát Z - E - D */}
      <Card className="border-teal-200 bg-teal-50/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-teal-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-teal-950">
                4.1. Bảng Đối Soát Tổng Thể Khảo Sát Căn Hộ {unitLabel} (Tầng {formData.floorNumber})
              </h2>
              <p className="text-xs text-slate-600">
                Rà soát toàn bộ cấu trúc Vùng Z, Cấu kiện E và Khuyết tật D trước khi nộp hồ sơ
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-teal-700 text-white self-start sm:self-center">
            {allDefects.length} Khuyết tật ghi nhận
          </span>
        </div>

        {/* 5 Thẻ tóm tắt tiến độ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Chủ sở hữu:</span>
            <strong className="text-slate-900 truncate block font-bold mt-0.5">
              {formData.ownerName || 'Chưa có tên'}
            </strong>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Vùng kiến trúc (Z):</span>
            <strong className="text-teal-800 font-bold mt-0.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              {zones.length} Vùng
            </strong>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Cấu kiện kết cấu (E):</span>
            <strong className="text-amber-800 font-bold mt-0.5 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-amber-600" />
              {hasStructuralElements ? `${structuralElements.length} Cấu kiện` : 'Miễn khảo sát'}
            </strong>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">Tổng khuyết tật (D):</span>
            <strong className="text-slate-900 font-bold mt-0.5 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-rose-600" />
              {allDefects.length} Điểm
            </strong>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-slate-500 block text-[11px]">Burland Max (E1):</span>
            <strong className={`font-bold mt-0.5 block ${maxBurlandGrade >= 3 ? 'text-rose-600' : 'text-emerald-700'}`}>
              Cấp {maxBurlandGrade} {criticalDefectCount > 0 && `(⚠️ ${criticalDefectCount} nứt ≥2mm)`}
            </strong>
          </div>
        </div>

        {/* Cảnh báo nếu có vết nứt nguy hiểm */}
        {criticalDefectCount > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Cảnh báo: Hồ sơ ghi nhận <strong>{criticalDefectCount} vết nứt</strong> có bề rộng lớn hơn 2.0mm. Đề xuất Zone Admin lưu ý theo dõi khi máy đào TBM metro đi qua.
            </span>
          </div>
        )}

        {/* Danh sách các Vùng Kiến Trúc Z */}
        <div className="bg-white rounded-xl border border-teal-200 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100">
            <span className="flex items-center gap-1.5 text-teal-800">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              Danh Sách Vùng Kiến Trúc ({zones.length} Vùng Z)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {zones.map((z, idx) => (
              <div
                key={`z-summary-${idx}`}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-600 text-white">
                      {z.zoneCode}
                    </span>
                    <strong className="text-slate-900 truncate">{z.roomName || 'Chưa đặt tên'}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {z.componentType || 'Tường'} • {z.wallMaterial || 'Gạch trát vữa'}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    z.defects && z.defects.length > 0
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {z.defects && z.defects.length > 0 ? `${z.defects.length} khuyết tật` : 'Nguyên vẹn'}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {z.ctxPhotoUrl ? '✓ Có ảnh CTX' : 'Chưa có ảnh'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danh sách các Cấu Kiện Kết Cấu E (nếu có) */}
        {hasStructuralElements && structuralElements.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1.5 border-b border-slate-100">
              <span className="flex items-center gap-1.5 text-amber-800">
                <Building className="w-3.5 h-3.5 text-amber-600" />
                Danh Sách Cấu Kiện Kết Cấu ({structuralElements.length} Cấu kiện E)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {structuralElements.map((e, idx) => (
                <div
                  key={`e-summary-${idx}`}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-600 text-white">
                        {e.elementCode}
                      </span>
                      <strong className="text-slate-900 truncate">{e.elementType || 'Cột BTCT'}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {e.materialType || 'BTCT toàn khối'} • {e.roomName || 'Căn hộ'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      e.defects && e.defects.length > 0
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {e.defects && e.defects.length > 0 ? `${e.defects.length} khuyết tật` : 'Ổn định'}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {e.overviewPhotos && e.overviewPhotos.length > 0
                        ? `✓ ${e.overviewPhotos.length} ảnh toàn cảnh`
                        : e.ctxPhotoUrl
                        ? '✓ Có ảnh CTX'
                        : 'Chưa có ảnh'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 4.2. Ý kiến của chủ sở hữu căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <FileCheck className="w-5 h-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              4.2. Ý Kiến Xác Nhận Của Chủ Sở Hữu / Người Sử Dụng Căn Hộ
            </h2>
            <p className="text-xs text-slate-500">
              Ghi nhận ý kiến, nguyện vọng hoặc kiến nghị trực tiếp từ chủ hộ trong quá trình khảo sát
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            label="Ý kiến hoặc kiến nghị của chủ căn hộ"
            placeholder="VD: Gia đình nhất trí với số liệu ghi nhận hiện trạng; Đề nghị đơn vị metro lưu ý theo dõi khi đào hầm..."
            value={formData.ownerFeedback}
            onChange={(e) => updateFormData({ ownerFeedback: e.target.value })}
          />
        </div>
      </Card>

      {/* 4.3. Ảnh chụp biên bản khảo sát hiện trường & Chữ ký giấy (Working Minutes Photos) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                4.3. Ảnh Chụp Biên Bản Khảo Sát Giấy & Chữ Ký Tươi (Tùy chọn)
              </h2>
              <p className="text-xs text-slate-500">
                Đính kèm ảnh chụp biên bản giấy có chữ ký tươi của chủ hộ và khảo sát viên (nếu ký trên bản cứng hiện trường)
              </p>
            </div>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
            {formData.workingMinutesPhotos?.length || 0} ảnh
          </span>
        </div>

        {/* Existing photos preview */}
        {formData.workingMinutesPhotos && formData.workingMinutesPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {formData.workingMinutesPhotos.map((url, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <TapToZoomThumbnail
                  src={url}
                  alt={`Biên bản ${idx + 1}`}
                  label={`Trang ${idx + 1}`}
                  photoCode={`MINUTES_PAGE_${idx + 1}`}
                  aspectClass="w-full h-32 aspect-auto"
                  actions={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = (formData.workingMinutesPhotos || []).filter((_, i) => i !== idx);
                        updateFormData({ workingMinutesPhotos: next });
                      }}
                      className="p-1 rounded-md bg-rose-600 text-white text-xs cursor-pointer shadow-md hover:bg-rose-700"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Upload new minutes photo */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <PhotoCaptureInput
            label="+ Chụp / Tải thêm ảnh biên bản giấy"
            value=""
            onChange={(url) => {
              if (url) {
                const next = [...(formData.workingMinutesPhotos || []), url];
                updateFormData({ workingMinutesPhotos: next });
              }
            }}
            watermarkOptions={{
              parcelCode: bCode,
              buildingCode: bCode,
              floorCode,
              floor: floorCode,
              unitCode: formData.unitCode,
              areaType: 'CONDO_UNIT',
              category: 'legal',
              photoType: 'MINUTES',
              photoIndex: (formData.workingMinutesPhotos?.length || 0) + 1,
            }}
            height="110px"
          />
        </div>
      </Card>

      {/* 4.4. Trạng Thái Cổng Kiểm Soát Nghiệp Vụ (Validation Gate Status) */}
      <Card
        className={`border shadow-xs p-4 ${
          validation.blockingIssues.length > 0
            ? 'border-rose-300 bg-rose-50/60'
            : validation.warnings.length > 0
            ? 'border-amber-300 bg-amber-50/50'
            : 'border-emerald-300 bg-emerald-50/50'
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            {validation.blockingIssues.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : validation.warnings.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {validation.blockingIssues.length > 0
                  ? `Chưa đủ điều kiện nộp: Còn ${validation.blockingIssues.length} mục bắt buộc cần bổ sung`
                  : validation.warnings.length > 0
                  ? `Hồ sơ hợp lệ, có ${validation.warnings.length} khuyến nghị (cho phép nộp)`
                  : 'Hồ sơ đạt chuẩn 100%, sẵn sàng nộp lên hệ thống!'}
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {validation.blockingIssues.length > 0
                  ? 'Bấm "Hoàn Tất & Nộp Hồ Sơ Căn Hộ" bên dưới để xem chi tiết danh sách và bấm "Điền ngay".'
                  : 'Dữ liệu định danh, ảnh nhận diện và khuyết tật đã được thẩm định an toàn.'}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              validation.blockingIssues.length > 0
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : validation.warnings.length > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {validation.blockingIssues.length > 0
              ? `${validation.blockingIssues.length} mục thiếu`
              : 'Đủ điều kiện nộp'}
          </span>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          Bước 3 (Khuyết tật & Kết cấu)
        </Button>

        {isReadOnly ? (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Hồ sơ đã nộp thành công (Chế độ xem lại)</span>
          </div>
        ) : (
          <Button
            size="lg"
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-md cursor-pointer min-h-[44px]"
            disabled={isSubmitting}
            onClick={onSubmitFinal}
            icon={<Send className="w-4 h-4" />}
          >
            {isSubmitting ? 'Đang nộp hồ sơ...' : 'Hoàn Tất & Nộp Hồ Sơ Căn Hộ'}
          </Button>
        )}
      </div>
    </div>
  );
};

