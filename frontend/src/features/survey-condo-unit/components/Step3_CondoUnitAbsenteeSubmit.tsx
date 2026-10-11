import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../components/common/TapToZoomThumbnail';
import { SignaturePad } from '../../../components/canvas/SignaturePad';
import {
  FileCheck,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Camera,
  Trash2,
  Cloud,
  FileText,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { validateCondoUnitFull } from '../utils/condoUnitValidator';
import { auditCondoUnitPhotos } from '../utils/condoUnitPhotoAudit';
import { useSurveyReadOnly } from '../../../core/context/SurveyReadOnlyContext';

interface Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
}

export const Step3_CondoUnitAbsenteeSubmit: React.FC<Props> = ({ onSubmitFinal, isSubmitting }) => {
  const {
    formData,
    updateFormData,
    addAbsenteeMinutesPhoto,
    removeAbsenteeMinutesPhoto,
    prevStep,
    isReadOnly: storeReadOnly,
    setIsPhotoAuditOpen,
  } = useCondoUnitSurveyStore();

  const contextReadOnly = useSurveyReadOnly();
  const isReadOnly = contextReadOnly ?? storeReadOnly;

  const validation = validateCondoUnitFull(formData);
  const audit = auditCondoUnitPhotos(formData);

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
  const absInfo = formData.absenteeInfo;
  const minutesPhotos = absInfo?.absenteeMinutesPhotos || formData.absenteeMinutesPhotos || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 3.1. Tóm Tắt Định Danh & Lý Do Vắng Nhà */}
      <Card className="border-purple-200 bg-purple-50/40 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-200">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-purple-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-purple-950">
                3.1. Tóm Tắt Hồ Sơ Vắng Mặt Căn Hộ {unitLabel} (Tầng {formData.floorNumber})
              </h2>
              <p className="text-xs text-purple-800">
                Đối soát các căn cứ ngoại quan và chuẩn bị nộp biên bản vắng chủ
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-700 text-white self-start sm:self-center">
            {formData.parentInfo?.projectParcelCode}-U{formData.unitCode}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white rounded-xl border border-purple-100">
            <span className="text-slate-500 block">Biển số thực tế:</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">{formData.displayCode || '---'}</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-purple-100">
            <span className="text-slate-500 block">Lý do vắng mặt:</span>
            <span className="font-bold text-purple-800 text-sm mt-0.5 block truncate">
              {absInfo?.absenceReason === 'HOMEOWNER_ABSENT'
                ? 'Khóa cửa ngoài'
                : absInfo?.absenceReason === 'UNOCCUPIED_EMPTY'
                ? 'Chưa về ở'
                : absInfo?.absenceReason === 'REFUSED_ACCESS'
                ? 'Từ chối tiếp cận'
                : absInfo?.absenceReason === 'LOCKED_SECURITY'
                ? 'Niêm phong BQL'
                : absInfo?.customReason || 'Khác'}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-purple-100">
            <span className="text-slate-500 block">Người làm chứng:</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
              {absInfo?.witnessName || 'BQL / Bảo vệ tòa nhà'}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-purple-100">
            <span className="text-slate-500 block">Số lần tiếp cận:</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
              Lần thứ {absInfo?.attemptCount || 1}
            </span>
          </div>
        </div>
      </Card>

      {/* 3.2. Bộ Ảnh Biên Bản Xác Nhận Vắng Chủ & Giấy Hẹn Dán Cửa */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                3.2. Ảnh Biên Bản Vắng Chủ / Giấy Hẹn Dán Cửa *
              </h2>
              <p className="text-xs text-slate-500">
                Bắt buộc chụp tối thiểu 1 ảnh: Giấy hẹn dán tại cửa phòng hoặc biên bản giấy có BQL/Bảo vệ ký
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
            {minutesPhotos.length} ảnh
          </span>
        </div>

        {/* Existing photos preview */}
        {minutesPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {minutesPhotos.map((url, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
                <TapToZoomThumbnail
                  src={url}
                  alt={`Biên bản vắng mặt ${idx + 1}`}
                  label={`Biên bản #${idx + 1}`}
                  photoCode={`ABSENT_MINUTES_${idx + 1}`}
                  aspectClass="h-32"
                />

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => removeAbsenteeMinutesPhoto(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600/90 text-white hover:bg-rose-700 transition-all opacity-90 hover:opacity-100 shadow-xs cursor-pointer"
                    title="Xóa ảnh này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-rose-300 bg-rose-50/50 text-center space-y-1">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-rose-800">
              Chưa có ảnh biên bản xác nhận hoặc giấy hẹn dán cửa phòng
            </p>
            <p className="text-[11px] text-slate-500">
              Vui lòng chụp ảnh dán giấy hẹn tại cửa hoặc ảnh biên bản có xác nhận của BQL để làm căn cứ pháp lý.
            </p>
          </div>
        )}

        {/* Upload new photo */}
        {!isReadOnly && (
          <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200">
            <PhotoCaptureInput
              label="+ Chụp / Tải thêm ảnh giấy hẹn hoặc biên bản giấy"
              value=""
              readOnly={isReadOnly}
              onChange={(url) => {
                if (url) {
                  addAbsenteeMinutesPhoto(url);
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
                photoType: 'ABSENTEE_MINUTES',
                photoIndex: minutesPhotos.length + 1,
              }}
              height="110px"
            />
          </div>
        )}
      </Card>

      {/* 3.3. Chữ Ký Xác Nhận Của Khảo Sát Viên (KSV) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                3.3. Chữ Ký Số Khảo Sát Viên Tại Hiện Trường *
              </h2>
              <p className="text-xs text-slate-500">
                Khảo sát viên ký số cam kết đã đến tiếp cận thực tế nhưng chủ nhà vắng mặt
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
            Chủ nhà vắng mặt (Miễn ký chủ hộ)
          </span>
        </div>

        <div className="max-w-md mx-auto">
          <SignaturePad
            label="Chữ ký Khảo sát viên (KSV) *"
            signerName={formData.surveyorSignature ? 'Đã ký số' : 'Khảo sát viên'}
            role="SURVEYOR"
            initialSignatureUrl={formData.surveyorSignature || formData.signatures?.surveyorSignature}
            onSave={(sigUrl) => {
              updateFormData({
                surveyorSignature: sigUrl,
                signatures: {
                  ...formData.signatures,
                  surveyorSignature: sigUrl,
                },
              });
            }}
            readOnly={isReadOnly}
          />
        </div>
      </Card>

      {/* 3.4. Trạng Thái Cổng Kiểm Soát Nghiệp Vụ & Cloud R2 */}
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
                  : 'Hồ sơ vắng mặt đã đủ điều kiện, sẵn sàng nộp lên hệ thống!'}
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {validation.blockingIssues.length > 0
                  ? validation.blockingIssues.map((i) => i.title).join(' • ')
                  : 'Đã hoàn thành ảnh định danh P01/P04, thông tin căn hộ, ảnh biên bản và chữ ký KSV.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {audit.unsynced > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPhotoAuditOpen(true)}
                className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer text-xs"
                icon={<Cloud className="w-3.5 h-3.5" />}
              >
                Đồng bộ {audit.unsynced} ảnh Cloud
              </Button>
            )}

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                validation.blockingIssues.length > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {validation.blockingIssues.length > 0
                ? `${validation.blockingIssues.length} lỗi chặn`
                : 'Đủ điều kiện nộp'}
            </span>
          </div>
        </div>
      </Card>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button
          variant="secondary"
          size="md"
          onClick={prevStep}
          icon={<ArrowLeft className="w-4 h-4" />}
          className="cursor-pointer"
        >
          Quay Lại Bước 2
        </Button>

        {isReadOnly ? (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Hồ sơ vắng mặt đã nộp (Chế độ xem lại)</span>
          </div>
        ) : (
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-md cursor-pointer min-h-[44px]"
            disabled={isSubmitting || validation.blockingIssues.length > 0}
            onClick={onSubmitFinal}
            icon={<Send className="w-4 h-4" />}
          >
            {isSubmitting ? 'Đang nộp hồ sơ...' : 'Xác Nhận & Nộp Hồ Sơ Vắng Nhà'}
          </Button>
        )}
      </div>
    </div>
  );
};
