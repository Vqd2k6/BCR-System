import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import {
  isResidentStatus,
  isCondoUnitAbsenceReason,
  isCondoUnitWitnessRole,
  CONDO_UNIT_ABSENCE_REASONS,
  CONDO_UNIT_WITNESS_ROLES,
} from '../types/condo-unit.types';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import {
  Home,
  UserX,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Phone,
  UserCheck,
  FileCheck2,
  Undo2,
} from 'lucide-react';
import { useSurveyReadOnly } from '../../../core/context/SurveyReadOnlyContext';

export const Step2_CondoUnitAbsentee: React.FC = () => {
  const {
    formData,
    updateFormData,
    updateAbsenteeInfo,
    setAbsenteeMode,
    nextStep,
    prevStep,
    isReadOnly: storeReadOnly,
  } = useCondoUnitSurveyStore();

  const contextReadOnly = useSurveyReadOnly();
  const isReadOnly = contextReadOnly ?? storeReadOnly;

  const absInfo = formData.absenteeInfo || {
    absenceReason: 'HOMEOWNER_ABSENT',
    customReason: '',
    notes: '',
    witnessName: '',
    witnessRole: 'BUILDING_MANAGEMENT',
    witnessPhone: '',
    noticeDelivered: false,
    rescheduleDate: '',
    attemptCount: 1,
    absenteeMinutesPhotos: [],
  };

  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.displayCode?.trim()) &&
    Boolean(absInfo.absenceReason) &&
    (absInfo.absenceReason !== 'OTHER' || Boolean(absInfo.customReason?.trim() || absInfo.notes?.trim()));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Alert Header Thông Báo Chế Độ Vắng Mặt */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0 mt-0.5">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-purple-950 flex items-center gap-2">
              <span>Đang Trong Chế Độ: Lập Hồ Sơ Vắng Chủ Nhà</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-200 text-purple-900 border border-purple-300">
                POSTPONED_ABSENT
              </span>
            </h3>
            <p className="text-xs text-purple-800 leading-relaxed mt-0.5">
              Hệ thống tự động bỏ qua toàn bộ khảo sát nội thất Z-E-D và chữ ký chủ nhà. Chỉ thu thập định danh căn hộ, lý do vắng và biên bản xác nhận hiện trường.
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const confirmReturn = window.confirm(
                'Bạn có chắc chắn muốn chuyển lại luồng Khảo Sát Bình Thường?\n(Chỉ chuyển khi chủ nhà đã có mặt mở cửa cho vào bên trong)'
              );
              if (confirmReturn) {
                setAbsenteeMode(false);
              }
            }}
            className="border-purple-300 text-purple-700 hover:bg-purple-100 shrink-0 cursor-pointer"
            icon={<Undo2 className="w-3.5 h-3.5" />}
          >
            Chuyển Lại Khảo Sát Đầy Đủ
          </Button>
        )}
      </div>

      {/* Card 1: 2.1. Định danh căn hộ con tinh gọn */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                2.1. Định Danh Căn Hộ Con (Bên Ngoài Cửa)
              </h2>
              <p className="text-xs text-slate-500">
                Đối soát số phòng thực tế gắn trên cửa với mã vị trí quy hoạch
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-lg">
            {formData.parentInfo.projectParcelCode}-U{formData.unitCode || '---'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div id="input-displayCode">
            <Input
              label="Biển Số Thực Tế (Ảnh P01) *"
              placeholder="VD: 303, P.303, L.01"
              value={formData.displayCode || ''}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ displayCode: e.target.value })}
              hint="Số phòng thực tế cư dân nhìn thấy"
            />
          </div>

          <div id="input-unitCode">
            <Input
              label="Mã Vị Trí CAD (mm.nn) *"
              placeholder="VD: 03.03, 12.04"
              value={formData.unitCode || ''}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ unitCode: e.target.value })}
              hint="Mã quy hoạch theo tầng & vị trí"
            />
          </div>

          <div>
            <Input
              label="Tầng Lầu (Floor) *"
              type="number"
              step="any"
              min={-4}
              max={99}
              value={formData.floorNumber}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ floorNumber: parseFloat(e.target.value) || 1 })}
              hint="Trệt: 0, Lửng: 0.5, Lầu: 1, 2..."
            />
          </div>

          <div>
            <Input
              label="Diện Tích Căn Hộ (m²)"
              type="number"
              step="any"
              min={0}
              placeholder="VD: 75.5"
              value={formData.unitAreaM2 === '' ? '' : formData.unitAreaM2}
              disabled={isReadOnly}
              onChange={(e) =>
                updateFormData({
                  unitAreaM2: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              hint="Tùy chọn (theo BQL hoặc hồ sơ)"
            />
          </div>
        </div>

        <div id="select-residentStatus" className="pt-2">
          <Select
            label="Tình Trạng Cư Trú Hiện Tại *"
            value={formData.residentStatus}
            disabled={isReadOnly}
            onChange={(e) => {
              const val = e.target.value;
              if (isResidentStatus(val)) {
                updateFormData({ residentStatus: val });
              }
            }}
            options={[
              { value: 'VẮNG_MẶT_KHÓA_CỬA', label: 'Vắng mặt khóa cửa ngoài (Không tiếp cận được)' },
              { value: 'BỎ_TRỐNG_CHƯA_VỀ_Ở', label: 'Căn hộ bỏ trống / Chưa có người về ở' },
              { value: 'CHO_THUÊ', label: 'Cho thuê (Khách thuê vắng mặt)' },
              { value: 'CHỦ_HỘ_Ở', label: 'Chủ hộ ở (Chủ hộ vắng mặt)' },
            ]}
          />
        </div>

        {/* Thông tin chủ hộ nếu có (Không bắt buộc) */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Thông Tin Chủ Hộ (Nếu BQL Tòa Nhà Cung Cấp - Không Bắt Buộc)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Họ và Tên Chủ Căn Hộ"
              placeholder="VD: Nguyễn Văn A (nếu biết)"
              value={formData.ownerName || ''}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ ownerName: e.target.value })}
            />
            <Input
              label="Số Điện Thoại Chủ Hộ"
              placeholder="VD: 0901234567"
              value={formData.ownerPhone || ''}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
            />
            <Input
              label="Số CCCD / CMND"
              placeholder="VD: 079090123456"
              value={formData.ownerIdCard || ''}
              disabled={isReadOnly}
              onChange={(e) => updateFormData({ ownerIdCard: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Card 2: 2.2. Ghi nhận vắng nhà & Người chứng kiến BQL */}
      <Card className="border-purple-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-purple-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                2.2. Ghi Nhận Lý Do Vắng Mặt & Bên Thứ 3 Xác Nhận
              </h2>
              <p className="text-xs text-slate-500">
                Thu thập căn cứ chứng minh KSV đã tiếp cận thực tế nhưng không thể vào căn hộ
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg">
            Tiếp cận lần {absInfo.attemptCount || 1}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id="select-absenceReason">
            <Select
              label="Lý Do Vắng Mặt / Không Tiếp Cận Được *"
              value={absInfo.absenceReason}
              disabled={isReadOnly}
              onChange={(e) => {
                const val = e.target.value;
                if (isCondoUnitAbsenceReason(val)) {
                  updateAbsenteeInfo({ absenceReason: val });
                }
              }}
              options={CONDO_UNIT_ABSENCE_REASONS.map((r) => ({
                value: r.value,
                label: r.label,
              }))}
            />
          </div>

          <div>
            <Input
              label="Số Lần Đã Tiếp Cận Căn Hộ *"
              type="number"
              min={1}
              max={10}
              value={absInfo.attemptCount || 1}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ attemptCount: parseInt(e.target.value, 10) || 1 })}
              hint="Ghi nhận số lần KSV đã đến căn hộ"
            />
          </div>
        </div>

        {absInfo.absenceReason === 'OTHER' && (
          <div id="input-customReason" className="animate-in fade-in">
            <Input
              label="Nhập Chi Tiết Lý Do Khác *"
              placeholder="VD: Cửa khóa vân tay, chuông báo hỏng, căn hộ đang tranh chấp..."
              value={absInfo.customReason || ''}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ customReason: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Ghi Chú Chi Tiết Quá Trình Tiếp Cận Tại Hiện Trường
          </label>
          <textarea
            rows={3}
            disabled={isReadOnly}
            placeholder="VD: Tổ khảo sát đã bấm chuông 3 lần và gõ cửa nhưng không có người trả lời. Đại diện bảo vệ tầng xác nhận căn hộ này chủ nhà hiện đang đi công tác dài ngày..."
            value={absInfo.notes || ''}
            onChange={(e) => updateAbsenteeInfo({ notes: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50/50"
          />
        </div>

        {/* Người chứng kiến / Bên thứ 3 */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>Người Làm Chứng / Đại Diện Bên Thứ 3 Xác Nhận Căn Hộ Khóa Cửa</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Vai Trò Người Làm Chứng"
              value={absInfo.witnessRole || 'BUILDING_MANAGEMENT'}
              disabled={isReadOnly}
              onChange={(e) => {
                const val = e.target.value;
                if (isCondoUnitWitnessRole(val)) {
                  updateAbsenteeInfo({ witnessRole: val });
                }
              }}
              options={CONDO_UNIT_WITNESS_ROLES.map((w) => ({
                value: w.value,
                label: w.label,
              }))}
            />

            <Input
              label="Họ và Tên Người Làm Chứng"
              placeholder="VD: Trần Văn B (Bảo vệ ca sáng)"
              value={absInfo.witnessName || ''}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ witnessName: e.target.value })}
            />

            <Input
              label="Số Điện Thoại Người Làm Chứng"
              placeholder="VD: 0918123456"
              value={absInfo.witnessPhone || ''}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ witnessPhone: e.target.value })}
            />
          </div>
        </div>

        {/* Giấy hẹn & Lịch hẹn lại */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="noticeDeliveredCheckbox"
              checked={Boolean(absInfo.noticeDelivered)}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ noticeDelivered: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="noticeDeliveredCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Đã dán Giấy Hẹn / Thông Báo Khảo Sát tại cửa phòng căn hộ
            </label>
          </div>

          <div>
            <Input
              label="Lịch Hẹn Dự Kiến Tiếp Cận Lại"
              type="datetime-local"
              value={absInfo.rescheduleDate || ''}
              disabled={isReadOnly}
              onChange={(e) => updateAbsenteeInfo({ rescheduleDate: e.target.value })}
              hint="Ngày giờ KSV dự kiến quay lại kiểm tra"
            />
          </div>
        </div>
      </Card>

      {/* Thanh điều hướng */}
      <div className="flex items-center justify-between pt-2">
        <Button
          size="md"
          variant="outline"
          onClick={prevStep}
          icon={<ArrowLeft className="w-4 h-4" />}
          className="cursor-pointer"
        >
          Quay Lại Bước 1
        </Button>

        <Button
          size="md"
          onClick={nextStep}
          disabled={!isReadOnly && !isFormValid}
          icon={<ArrowRight className="w-4 h-4" />}
          className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs"
        >
          Tiếp Tục: Chụp Biên Bản & Nộp Hồ Sơ ➔
        </Button>
      </div>
    </div>
  );
};
