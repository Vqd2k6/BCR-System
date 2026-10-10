import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { SurveyReviewBanner } from '../components/SurveyReviewBanner';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { TapToZoomThumbnail } from '../../../components/common/TapToZoomThumbnail';
import {
  Building,
  UserX,
  FileText,
  Camera,
  Maximize2,
  CheckCircle2,
  Calendar,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';

interface AbsenteeReviewViewProps {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  readOnly: boolean;
  canApproveOrReject: boolean;
  onApprove: () => void;
  onReject: () => void;
  onBackToHome: () => void;
}

export const AbsenteeReviewView: React.FC<AbsenteeReviewViewProps> = ({
  parcel,
  unit,
  readOnly,
  canApproveOrReject,
  onApprove,
  onReject,
  onBackToHome,
}) => {
  const { formData } = usePhase1SurveyStore();

  const parcelCode =
    formData.projectParcelCode ||
    formData.officialCadastralCode ||
    parcel?.projectParcelCode ||
    parcel?.officialCadastralCode ||
    parcel?.id ||
    'THỬA ĐẤT';

  const fullAddress = [
    formData.houseNumber || parcel?.houseNumber,
    formData.street || parcel?.street,
  ]
    .filter(Boolean)
    .join(', ') || 'Chưa cập nhật địa chỉ';

  const minutesPhotos = formData.absenteeMinutesPhotos || [];
  const attemptCount = parcel?.absenceAttemptCount || 1;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* 1. Review Banner ở trên cùng */}
      <SurveyReviewBanner
        readOnly={readOnly}
        canApproveOrReject={canApproveOrReject}
        targetCode={`${parcelCode} (VẮNG CHỦ)`}
        onApprove={onApprove}
        onReject={onReject}
        onBack={onBackToHome}
      />

      {/* 2. Top Header thông báo hồ sơ vắng nhà */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-2xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-600 text-white shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-amber-900">
                  Hồ Sơ Khảo Sát Vắng Chủ Nhà (Không Tiếp Cận Được)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  VẮNG NHÀ
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Hồ sơ chỉ thu thập hiện trạng ngoại quan bên ngoài & biên bản xác nhận vắng mặt. Không thực hiện các bước khảo sát nội thất 2, 3, 4.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onBackToHome}
            className="bg-white hover:bg-amber-100 text-amber-900 border-amber-300 shrink-0 cursor-pointer"
          >
            Đóng xem lại
          </Button>
        </div>
      </div>

      {/* 3. Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-6 py-6 space-y-5">
        {/* THẺ 1: BIÊN BẢN XÁC NHẬN VẮNG MẶT & LÝ DO */}
        <Card className="border-amber-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                1. Biên Bản Xác Nhận Vắng Mặt & Lý Do Không Tiếp Cận
              </h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              Lần ghé thăm: {attemptCount}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <span className="text-xs font-bold text-amber-900 block uppercase tracking-wider">
                Lý Do Vắng Mặt / Khóa Cửa:
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-amber-100 shadow-2xs">
                {formData.absenteeReason || 'Chủ hộ đi vắng, cửa khóa ngoài, không thể liên hệ qua điện thoại.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                Thông Tin Xác Nhận Hiện Trường:
              </span>
              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Thời điểm lập hồ sơ: <strong>{new Date().toLocaleDateString('vi-VN')}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Trạng thái: <strong>Chờ Zone Admin phê duyệt biên bản vắng mặt</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Gallery Ảnh Biên Bản Vắng Nhà */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-700 block">
              Ảnh Biên Bản Vắng Nhà / Niêm Phong / Giấy Hẹn ({minutesPhotos.length} ảnh):
            </span>

            {minutesPhotos.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                Chưa có ảnh biên bản xác nhận vắng mặt.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {minutesPhotos.map((photoUrl, idx) => (
                  <TapToZoomThumbnail
                    key={idx}
                    src={photoUrl}
                    alt={`Biên bản ${idx + 1}`}
                    label={`Trang #${idx + 1}`}
                    title={`Biên bản vắng mặt #${idx + 1} - ${parcelCode}`}
                    aspectRatio="video"
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* THẺ 2: THÔNG TIN ĐỊNH DANH CÔNG TRÌNH & THỬA ĐẤT */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              2. Thông Tin Định Danh Công Trình & Thửa Đất
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 font-medium block">Mã Dự Án / Địa Chính:</span>
              <span className="font-extrabold text-slate-800 text-sm mt-0.5 block font-mono">
                {parcelCode}
              </span>
              {formData.officialCadastralCode && formData.officialCadastralCode !== formData.projectParcelCode && (
                <span className="text-[11px] text-slate-500 font-mono block">
                  Số tờ/thửa: {formData.officialCadastralCode}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2">
              <span className="text-slate-500 font-medium block">Địa Chỉ Công Trình:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {fullAddress}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 font-medium block">Chủ Sở Hữu:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {formData.ownerName || parcel?.ownerName || 'Chưa cập nhật'}
              </span>
              {formData.ownerPhone && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {formData.ownerPhone}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 font-medium block">Nhóm Đối Tượng:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {formData.objectGroup === 'CRITICAL'
                  ? 'Đặc biệt quan trọng'
                  : formData.objectGroup === 'IMPORTANT'
                  ? 'Quan trọng'
                  : 'Thông thường'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-500 font-medium block">Lý Trình Tuyến Metro:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block font-mono">
                {formData.chainage || 'Km 0+000'}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Cách tim hầm: {formData.metroOffsetDistance || '---'}
              </span>
            </div>
          </div>
        </Card>

        {/* THẺ 3: BỘ ẢNH NGOẠI QUAN BÊN NGOÀI (P-01 ĐẾN P-04) */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Camera className="w-5 h-5 text-sky-600" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              3. Ảnh Ngoại Quan Ghi Nhận Từ Bên Ngoài
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* P-01 Số nhà */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Ảnh P-01: Biển Số Nhà</span>
                {formData.photoP01?.notApplicable && <Badge variant="neutral">Không áp dụng</Badge>}
              </div>
              {formData.photoP01?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP01.url}
                  alt="Ảnh P-01: Biển Số Nhà"
                  label="P-01"
                  photoCode="P-01"
                  title="Ảnh P-01: Biển Số Nhà"
                  aspectRatio="video"
                />
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300">
                  Chưa có ảnh P-01
                </div>
              )}
            </div>

            {/* P-02 Mặt đứng */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Ảnh P-02: Mặt Đứng Chính</span>
                {formData.photoP02?.notApplicable && <Badge variant="neutral">Không áp dụng</Badge>}
              </div>
              {formData.photoP02?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP02.url}
                  alt="Ảnh P-02: Mặt Đứng Chính"
                  label="P-02"
                  photoCode="P-02"
                  title="Ảnh P-02: Mặt Đứng Chính"
                  aspectRatio="video"
                />
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300">
                  Chưa có ảnh P-02
                </div>
              )}
            </div>

            {/* P-03 Hông / sau */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Ảnh P-03: Mặt Hông / Sau</span>
                {formData.photoP03?.notApplicable && <Badge variant="neutral">Không áp dụng</Badge>}
              </div>
              {formData.photoP03?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP03.url}
                  alt="Ảnh P-03: Mặt Hông / Sau"
                  label="P-03"
                  photoCode="P-03"
                  title="Ảnh P-03: Mặt Hông / Sau"
                  aspectRatio="video"
                />
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300">
                  Chưa có ảnh P-03
                </div>
              )}
            </div>

            {/* P-04 Bối cảnh */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Ảnh P-04: Bối Cảnh Tuyến Đường</span>
                {formData.photoP04?.notApplicable && <Badge variant="neutral">Không áp dụng</Badge>}
              </div>
              {formData.photoP04?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP04.url}
                  alt="Ảnh P-04: Bối Cảnh Tuyến Đường"
                  label="P-04"
                  photoCode="P-04"
                  title="Ảnh P-04: Bối Cảnh Tuyến Đường"
                  aspectRatio="video"
                />
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300">
                  Chưa có ảnh P-04
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* THẺ 4: ĐÓNG TAB / HÀNH ĐỘNG CUỐI CÙNG */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Hồ sơ được thẩm định theo quy chuẩn Phase 1 - Trường hợp Vắng chủ nhà.
          </div>

          <div className="flex items-center gap-2.5">
            {canApproveOrReject && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={onApprove}
                >
                  Phê Duyệt Hồ Sơ Vắng Nhà
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={onReject}
                  className="cursor-pointer"
                >
                  Từ Chối / Yêu Cầu Khảo Sát Lại
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onBackToHome}
              className="cursor-pointer"
            >
              Xác Nhận & Đóng Tab
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
