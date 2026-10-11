import React, { useState } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { TapToZoomThumbnail } from '../../../components/common/TapToZoomThumbnail';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import {
  Building2,
  UserX,
  Camera,
  CheckCircle2,
  Calendar,
  Phone,
  ShieldCheck,
  Undo2,
  ArrowLeft,
  FileText,
  Clock,
  Home,
  UserCheck,
} from 'lucide-react';
import api from '../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

interface Props {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  onBackToHome: () => void;
  onReopened?: () => void;
}

export const CondoUnitAbsenteeReviewView: React.FC<Props> = ({
  parcel,
  unit,
  onBackToHome,
  onReopened,
}) => {
  const {
    formData,
    applyFormData,
    setIsReadOnly,
    setAbsenteeMode,
    markDraftHydrated,
  } = useCondoUnitSurveyStore();

  const [isReopening, setIsReopening] = useState(false);

  const parent = formData.parentInfo;
  const absInfo = formData.absenteeInfo;
  const unitLabel = formData.displayCode || formData.unitCode || unit?.unit_code || '---';
  const minutesPhotos = absInfo?.absenteeMinutesPhotos || formData.absenteeMinutesPhotos || [];

  const handleReopenSurvey = async () => {
    const confirmed = window.confirm(
      `Xác nhận mở lại khảo sát nội thất cho căn hộ ${unitLabel}?\n\n` +
      `Bộ ảnh nhận diện cửa ngoài (P01, P04) và định danh căn hộ sẽ được giữ nguyên 100%.\n` +
      `Khảo sát viên có thể vào trong nhà để thực hiện khảo sát các phòng Z, cấu kiện E, khuyết tật D và lấy chữ ký chủ hộ.`
    );
    if (!confirmed) return;

    try {
      setIsReopening(true);
      const targetUnitId = unit?.id || formData.unitId;
      const targetParcelId = parcel?.id || formData.parcelId;

      // Gọi API cập nhật trạng thái về IN_PROGRESS
      const res = await api.post(`/admin/reports/${targetParcelId}/revert-to-draft`, {
        unitId: targetUnitId,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Không thể mở lại khảo sát');
      }

      // Cập nhật store và mở khóa form
      applyFormData({
        status: 'IN_PROGRESS',
        isAbsentee: false,
        residentStatus: 'CHỦ_HỘ_Ở',
        resumedFromAbsentee: true,
      });
      setIsReadOnly(false);
      markDraftHydrated();

      if (unit) {
        unit.status = 'IN_PROGRESS';
      }

      alert(`✅ Đã mở lại khảo sát cho căn hộ ${unitLabel}! Mời bạn tiếp tục khảo sát nội thất.`);
      if (onReopened) {
        onReopened();
      }
    } catch (err: unknown) {
      console.error('[CondoUnitAbsenteeReviewView] Reopen error:', err);
      alert(`❌ Lỗi mở lại khảo sát: ${getErrorMessage(err)}`);
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner Thông Báo Hồ Sơ Vắng Chủ */}
      <header className="sticky top-0 z-40 bg-purple-900 text-white shadow-md border-b border-purple-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-1.5 rounded-lg bg-purple-800 hover:bg-purple-700 text-white transition-colors cursor-pointer shrink-0"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-purple-100">
                  Căn Hộ {unitLabel} (Tầng {formData.floorNumber})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-300 text-purple-950">
                  POSTPONED_ABSENT
                </span>
                <span className="text-xs text-purple-200">
                  • {parent.buildingName || 'Tòa Chung Cư'}
                </span>
              </div>
              <p className="text-[11px] text-purple-200 mt-0.5">
                Hồ sơ đã ghi nhận vắng mặt / khóa cửa ngoài. Các bước nội thất tạm hoãn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Button
              size="sm"
              disabled={isReopening}
              onClick={handleReopenSurvey}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
              icon={<Undo2 className={`w-3.5 h-3.5 ${isReopening ? 'animate-spin' : ''}`} />}
            >
              {isReopening ? 'Đang mở lại...' : 'Mở Lại Khảo Sát Nội Thất (Chủ Nhà Có Mặt)'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Review Content */}
      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Card 1: 1.1 Thông tin Tòa nhà mẹ */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">
              1.1. Thông Tin Định Danh Tòa Nhà Chung Cư Mẹ
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Mã quản lý dự án:</span>
              <span className="font-bold text-teal-700 font-mono text-sm block mt-0.5">
                {parent.projectParcelCode || '---'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Tên khối tháp / tòa nhà:</span>
              <span className="font-bold text-slate-800 text-sm block mt-0.5 truncate">
                {parent.buildingName || 'Tòa Chung Cư'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Lý trình & Cự ly tim hầm:</span>
              <span className="font-bold text-slate-800 text-sm block mt-0.5">
                {parent.chainage || 'Km 0+000'} • {parent.metroOffsetDistance || '15m'}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: 1.2 Bộ 2 ảnh nhận diện cửa & hành lang */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <Camera className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">
              1.2. Bộ Ảnh Nhận Diện Cửa Căn Hộ & Lối Đi Hành Lang
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Ảnh P01: Biển số phòng gắn trên cửa
              </span>
              {formData.photoP01?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP01.url}
                  alt="Ảnh P01"
                  label="Ảnh P01: Biển số phòng"
                  photoCode={formData.photoP01.photoCode || 'P-01'}
                  aspectClass="h-40"
                />
              ) : (
                <div className="h-40 rounded-xl bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                  {formData.photoP01?.notApplicable ? 'Đánh dấu Không Áp Dụng (N/A)' : 'Chưa có ảnh'}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Ảnh P04: Toàn cảnh cửa & lối đi hành lang
              </span>
              {formData.photoP04?.url ? (
                <TapToZoomThumbnail
                  src={formData.photoP04.url}
                  alt="Ảnh P04"
                  label="Ảnh P04: Cửa & Hành lang"
                  photoCode={formData.photoP04.photoCode || 'P-04'}
                  aspectClass="h-40"
                />
              ) : (
                <div className="h-40 rounded-xl bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                  {formData.photoP04?.notApplicable ? 'Đánh dấu Không Áp Dụng (N/A)' : 'Chưa có ảnh'}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Card 3: 2.1 Định danh căn hộ & Tình trạng cư trú */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <Home className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">
              2.1. Định Danh Căn Hộ Con & Tình Trạng Cư Trú
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Biển số thực tế:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">{formData.displayCode || '---'}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Mã vị trí CAD:</span>
              <span className="font-bold text-teal-700 font-mono text-sm mt-0.5 block">{formData.unitCode || '---'}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Tầng / Lầu:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">Tầng {formData.floorNumber}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Diện tích căn hộ:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {formData.unitAreaM2 ? `${formData.unitAreaM2} m²` : 'Chưa xác định'}
              </span>
            </div>
          </div>

          {Boolean(formData.ownerName || formData.ownerPhone) && (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-4">
              <div>
                <span className="text-slate-500">Chủ hộ: </span>
                <span className="font-bold text-slate-800">{formData.ownerName || 'Chưa rõ'}</span>
              </div>
              <div>
                <span className="text-slate-500">Số điện thoại: </span>
                <span className="font-bold text-slate-800">{formData.ownerPhone || 'Chưa rõ'}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Card 4: 2.2 Ghi nhận lý do vắng & Bên thứ 3 */}
        <Card className="border-purple-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-purple-100">
            <UserX className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">
              2.2. Chi Tiết Ghi Nhận Vắng Mặt & Người Làm Chứng
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <span className="text-purple-700 block font-medium">Lý do vắng mặt:</span>
              <span className="font-bold text-purple-950 text-sm mt-0.5 block">
                {absInfo?.absenceReason === 'HOMEOWNER_ABSENT'
                  ? 'Chủ nhà đi vắng / Khóa cửa ngoài'
                  : absInfo?.absenceReason === 'UNOCCUPIED_EMPTY'
                  ? 'Căn hộ bỏ trống / Chưa về ở'
                  : absInfo?.absenceReason === 'REFUSED_ACCESS'
                  ? 'Từ chối cho vào khảo sát'
                  : absInfo?.absenceReason === 'LOCKED_SECURITY'
                  ? 'Niêm phong BQL / Không có chìa khóa'
                  : absInfo?.customReason || 'Lý do khác'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Người làm chứng:</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {absInfo?.witnessName || 'Ban Quản Lý Tòa Nhà'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {absInfo?.witnessRole === 'SECURITY'
                  ? 'Đội Bảo Vệ'
                  : absInfo?.witnessRole === 'FLOOR_LEADER'
                  ? 'Trưởng Tầng'
                  : 'BQL Tòa Nhà'}
                {absInfo?.witnessPhone ? ` • ${absInfo.witnessPhone}` : ''}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">Thông báo & Lịch hẹn:</span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                {absInfo?.noticeDelivered ? '✓ Đã dán giấy hẹn tại cửa' : 'Chưa dán giấy hẹn'}
              </span>
              {absInfo?.rescheduleDate && (
                <span className="text-[11px] text-slate-600 block mt-0.5">
                  Hẹn lại: {new Date(absInfo.rescheduleDate).toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          </div>

          {absInfo?.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">Ghi chú hiện trường:</span>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{absInfo.notes}</p>
            </div>
          )}
        </Card>

        {/* Card 5: 3.2 Bộ ảnh biên bản vắng chủ / Giấy hẹn dán cửa */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800">
                3.2. Ảnh Biên Bản Vắng Chủ / Giấy Hẹn Dán Cửa ({minutesPhotos.length} ảnh)
              </h3>
            </div>
          </div>

          {minutesPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {minutesPhotos.map((url, idx) => (
                <TapToZoomThumbnail
                  key={idx}
                  src={url}
                  alt={`Biên bản vắng mặt ${idx + 1}`}
                  label={`Biên bản #${idx + 1}`}
                  photoCode={`ABSENT_MINUTES_${idx + 1}`}
                  aspectClass="h-36"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
              Chưa có ảnh biên bản giấy hoặc giấy hẹn dán cửa được tải lên.
            </p>
          )}
        </Card>

        {/* Card 6: 3.3 Chữ ký số KSV */}
        <Card className="border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">
                3.3. Chữ Ký Xác Nhận Của Khảo Sát Viên Hiện Trường
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Ngày lập: {formData.surveyDate || new Date().toLocaleDateString('vi-VN')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-48 h-24 bg-white rounded-lg border border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
              {formData.surveyorSignature ? (
                <img
                  src={formData.surveyorSignature}
                  alt="Chữ ký KSV"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">Chưa có chữ ký</span>
              )}
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Khảo sát viên hiện trường</p>
              <p>Hồ sơ đã được ký số cam kết đến hiện trường tiếp cận căn hộ nhưng chủ nhà vắng mặt.</p>
              <p className="text-amber-700 font-semibold">Chủ nhà vắng mặt: Miễn chữ ký chủ hộ.</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};
