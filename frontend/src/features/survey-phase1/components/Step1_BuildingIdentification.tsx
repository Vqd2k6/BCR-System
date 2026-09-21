import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide, LevelOptionGuide } from './LevelSelectorWithGuide';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import {
  Building,
  MapPin,
  ShieldAlert,
  Compass,
  Camera,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Info,
} from 'lucide-react';
import { FacadePolygonCanvas } from '../../../components/canvas/FacadePolygonCanvas';
import { ObjectGroupType } from '../types/phase1.types';

const OBJECT_GROUPS: { value: ObjectGroupType; label: string; desc: string; badgeColor: string }[] = [
  {
    value: 'GENERAL',
    label: '1. Nhà ở dân dụng thông thường (General)',
    desc: 'Nhà phố, nhà liên kế, biệt thự thông thường, kết cấu dân dụng.',
    badgeColor: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  },
  {
    value: 'IMPORTANT',
    label: '2. Công trình nhạy cảm / Quan trọng (Important)',
    desc: 'Trường học, bệnh viện, chung cư cao tầng, công trình tập trung đông người.',
    badgeColor: 'bg-amber-50 border-amber-300 text-amber-800',
  },
  {
    value: 'CRITICAL',
    label: '3. Di tích lịch sử / Bảo tồn / Đặc biệt (Critical)',
    desc: 'Công trình di sản văn hóa, tôn giáo cổ, toà nhà kiểm soát an ninh quốc phòng.',
    badgeColor: 'bg-red-50 border-red-300 text-red-800',
  },
];

const ADJACENT_LEFT_RIGHT = [
  'Độc lập / Cách biệt > 0.5m',
  'Liền kề / Khe lún sát nhau < 0.5m',
  'Chung tường / Chung móng kết cấu',
  'Khu đất trống / Đường hẻm',
];

const ADJACENT_REAR = [
  'Độc lập / Cách biệt > 0.5m',
  'Sát lưng nhà lân cận (khe hở nhỏ)',
  'Chung tường sau / Giếng trời chung',
  'Khu đất trống / Hẻm sau',
];

const P03_TAGS = ['Bên hông trái', 'Bên hông phải', 'Phía sau', 'Khác'];

const SETTLEMENT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  { level: 0, title: 'Không', physicalManifestation: 'Không phát hiện dấu hiệu bất thường. Nền móng và tường phẳng phiu.' },
  { level: 1, title: 'Nghi ngờ / Rất nhẹ', physicalManifestation: 'Chớm xuất hiện vết nứt chân chim (<0.5mm) tiếp giáp móng-tường trệt.' },
  { level: 2, title: 'Rõ nhưng ổn định', physicalManifestation: 'Nền trệt lún lệch rõ rệt (1–2cm), mép chân tường nứt tách 1–3mm.' },
  { level: 3, title: 'Tiến triển / Nghiêm trọng', physicalManifestation: 'Nền lún sụt mạnh, nứt xiên bậc thang 45° tường bao ≥ 5mm.' },
  { level: 4, title: 'Mất ổn định / Nguy cấp', physicalManifestation: 'Móng bị gãy khúc hoặc trượt lún sâu, tường tách rời khung BTCT.' },
];

const TILT_LEVEL_OPTIONS: LevelOptionGuide[] = [
  { level: 0, title: 'Không', physicalManifestation: 'Công trình thẳng đứng, không có dấu hiệu nghiêng (<1‰).' },
  { level: 1, title: 'Nghi ngờ / Rất nhẹ', physicalManifestation: 'Độ nghiêng rất nhỏ (<2‰), sinh hoạt bình thường.' },
  { level: 2, title: 'Rõ nhưng ổn định', physicalManifestation: 'Nghiêng thấy rõ bằng mắt hoặc nivo (2–5‰).' },
  { level: 3, title: 'Tiến triển / Nghiêm trọng', physicalManifestation: 'Độ nghiêng lớn (5–10‰), có hiện tượng chạm đỉnh với nhà bên cạnh.' },
  { level: 4, title: 'Mất ổn định / Nguy cấp', physicalManifestation: 'Độ nghiêng vượt ngưỡng nguy cấp (>10‰), nguy cơ lật đổ sập.' },
];

const DATA_SOURCES = [
  'Quan sát hiện trường',
  'Thước Laser / Nivo',
  'Hồ sơ bản vẽ',
  'Chủ nhà cung cấp',
];

const ABSENTEE_REASONS = [
  'Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)',
  'Chủ hộ đi làm, không có người lớn ở nhà',
  'Từ chối phối hợp khảo sát',
  'Khu đất trống / Nhà đang tranh chấp',
  'Lý do khác',
];

export const Step1_BuildingIdentification: React.FC = () => {
  const { formData, updateFormData, nextStep, clearDraft } = usePhase1SurveyStore();

  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [isSubmittingAbsentee, setIsSubmittingAbsentee] = useState(false);
  const [showAbsenteeSuccessModal, setShowAbsenteeSuccessModal] = useState(false);

  const isAbsentee = Boolean(formData.isAbsenteeSurvey);

  const handleToggleAbsentee = () => {
    updateFormData({ isAbsenteeSurvey: !isAbsentee });
  };

  const validateAbsenteeCompleteness = () => {
    const hasAddress = Boolean(formData.street);
    const hasObjectGroup = Boolean(formData.objectGroup);
    const hasAdjacent =
      Boolean(formData.adjacentBuildings.left.details) &&
      Boolean(formData.adjacentBuildings.right.details) &&
      Boolean(formData.adjacentBuildings.back.details);
    const hasPhotos = Boolean(
      (formData.photoP01.url || formData.photoP01.notApplicable) &&
      (formData.photoP02.url || formData.photoP02.notApplicable) &&
      (formData.photoP04.url || formData.photoP04.notApplicable)
    );
    const hasSettlement = typeof formData.settlementTilt?.diffSettlement?.level === 'number';

    const isFullyComplete = hasAddress && hasObjectGroup && hasAdjacent && hasPhotos && hasSettlement;

    return {
      hasAddress,
      hasObjectGroup,
      hasAdjacent,
      hasPhotos,
      hasSettlement,
      isFullyComplete,
    };
  };

  const completeness = validateAbsenteeCompleteness();

  const handleSubmitAbsentee = async () => {
    try {
      setIsSubmittingAbsentee(true);
      console.log('[Phase1] Submitting Absentee Survey:', formData);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setShowAbsenteeSuccessModal(true);
    } catch (err) {
      console.error('Submit absentee error:', err);
      alert('Có lỗi khi gửi báo cáo vắng nhà.');
    } finally {
      setIsSubmittingAbsentee(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Absentee Mode Header Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">
              Bước 1: Nhận Diện & Định Danh Công Trình Thực Địa
            </h1>
            <p className="text-xs text-slate-500">
              Thu thập dữ liệu định danh, tuyến Metro GIS, tiếp xúc lân cận và bộ 4 ảnh toàn cảnh
            </p>
          </div>
        </div>

        <Button
          variant={isAbsentee ? 'danger' : 'outline'}
          size="sm"
          onClick={handleToggleAbsentee}
        >
          {isAbsentee ? '✕ Hủy chế độ Báo Vắng' : '🏠 Báo Vắng Nhà'}
        </Button>
      </div>

      {/* Absentee Survey Checklist Progress */}
      {isAbsentee && (
        <Card className="border-amber-300 bg-amber-50/50">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-amber-200 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3 className="font-bold text-sm sm:text-base">
              Tiến Độ Hoàn Thiện Hồ Sơ Ngoại Quan Bước 1 (Yêu cầu 100% để nộp)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                completeness.hasAddress
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-amber-200 text-slate-600'
              }`}
            >
              <span>1. Số nhà & Tuyến đường</span>
              {completeness.hasAddress ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-600 font-bold">Chưa đủ</span>
              )}
            </div>

            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                completeness.hasObjectGroup
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-amber-200 text-slate-600'
              }`}
            >
              <span>2. Nhóm đối tượng công trình</span>
              {completeness.hasObjectGroup ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-600 font-bold">Chưa chọn</span>
              )}
            </div>

            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                completeness.hasAdjacent
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-amber-200 text-slate-600'
              }`}
            >
              <span>3. Hiện trạng liền kề 3 hướng</span>
              {completeness.hasAdjacent ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-600 font-bold">Chưa đủ</span>
              )}
            </div>

            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between ${
                completeness.hasPhotos
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-amber-200 text-slate-600'
              }`}
            >
              <span>4. Bộ 4 ảnh hiện trường (P01 - P04)</span>
              {completeness.hasPhotos ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <span className="text-amber-600 font-bold">Chưa chụp đủ</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200">
            <Select
              label="Lý do chủ nhà vắng mặt / không tiếp cận:"
              value={formData.absenteeReason || ABSENTEE_REASONS[0]}
              onChange={(e) => updateFormData({ absenteeReason: e.target.value })}
              options={ABSENTEE_REASONS.map((r) => ({ value: r, label: r }))}
            />
          </div>
        </Card>
      )}

      {/* 1.1. Thông tin định danh công trình */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Building className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.1. Thông Tin Nhận Diện & Định Danh Công Trình
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Mã Quản Lý Dự Án (Project Parcel Code)"
            value={formData.projectParcelCode}
            disabled
            hint="Tự động cấp từ hệ thống theo lý trình"
          />
          <Input
            label="Mã Địa Chính Gốc (Cadastral Code / KS003)"
            value={formData.officialCadastralCode}
            disabled
            hint="Số tờ - Số thửa bản đồ địa chính nhà nước"
          />

          <Input
            label="Tên Công Trình / Biển Hiệu Riêng (Building Name)"
            placeholder="VD: Cửa hàng tiện lợi, Nhà thuốc, Ngân hàng (để trống nếu là nhà dân)"
            value={formData.buildingName}
            onChange={(e) => updateFormData({ buildingName: e.target.value })}
          />

          <Input
            label="Địa Chỉ Thực Tế Hiện Trường (Address) *"
            placeholder="Số nhà, Tên đường (Đối chiếu sơ đồ quy hoạch)"
            value={formData.houseNumber ? `${formData.houseNumber}, ${formData.street}` : formData.street}
            onChange={(e) => {
              const parts = e.target.value.split(',');
              if (parts.length > 1) {
                updateFormData({ houseNumber: parts[0].trim(), street: parts.slice(1).join(',').trim() });
              } else {
                updateFormData({ street: e.target.value });
              }
            }}
          />

          <div className="sm:col-span-2">
            <Input
              label="Chủ Sở Hữu / Người Sử Dụng (Owner / User)"
              placeholder={isAbsentee ? 'Chủ hộ vắng mặt (nếu biết tên thì ghi)' : 'Nguyễn Văn A'}
              value={formData.ownerName}
              onChange={(e) => updateFormData({ ownerName: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* 1.2. Nhóm đối tượng công trình */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.2. Nhóm Đối Tượng Công Trình
            </h2>
          </div>
          <InfoPopover title="Hướng dẫn phân loại nhóm đối tượng (V1)">
            <p className="mb-2 font-semibold">Quy tắc phân cấp đối tượng xây dựng Metro Line 2:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>General (1đ):</strong> Nhà ở gia đình, nhà phố 1-5 tầng, ki-ốt thông thường.</li>
              <li><strong>Important (2đ):</strong> Công trình công cộng, trường học, trạm y tế, chung cư tập trung đông dân cư.</li>
              <li><strong>Critical (4đ):</strong> Công trình bảo tồn di sản, chùa chiền, nhà thờ cổ, cơ sở hạ tầng an ninh quốc phòng trọng yếu.</li>
            </ul>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OBJECT_GROUPS.map((grp) => {
            const isSelected = formData.objectGroup === grp.value;
            return (
              <div
                key={grp.value}
                onClick={() => updateFormData({ objectGroup: grp.value })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${grp.badgeColor} border-current shadow-sm`
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm mb-1">{grp.label}</div>
                <div className="text-xs opacity-80 leading-relaxed">{grp.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 1.3. Thông tin tuyến Metro & GIS */}
      <Card className="border-sky-200 bg-sky-50/30">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.3. Thông Tin Tuyến Metro & Tọa Độ GIS
            </h2>
          </div>
          <InfoPopover title="Thông tin trích xuất tự động từ GIS">
            <p className="leading-relaxed">
              Các thông số khoảng cách tim Metro, ranh giải phóng mặt bằng (GPMB) và lý trình tuyến được tính toán tự động dựa trên vị trí GPS check-in và lớp bản đồ quy hoạch PostGIS tuyến Metro Line 2.
            </p>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-xl border border-sky-200">
            <span className="text-slate-500 block font-medium">Lý trình (Chainage)</span>
            <span className="text-sm font-bold text-slate-800">{formData.chainage || 'Km 0+000'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-sky-200">
            <span className="text-slate-500 block font-medium">Khoảng cách tới tim Metro</span>
            <span className="text-sm font-bold text-slate-800">{formData.metroOffsetDistance || '15.0m'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-sky-200">
            <span className="text-slate-500 block font-medium">Khoảng cách tới ranh GPMB</span>
            <span className="text-sm font-bold text-slate-800">{formData.clearanceOffsetDistance || '5.2m'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-sky-200">
            <span className="text-slate-500 block font-medium">Tọa độ GPS Check-in</span>
            <span className="text-sm font-bold text-sky-700 font-mono">
              {formData.gpsCoords?.lat?.toFixed(5)}, {formData.gpsCoords?.lng?.toFixed(5)}
            </span>
          </div>
        </div>
      </Card>

      {/* 1.4. Công trình liền kề 3 hướng */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.4. Công Trình Liền Kề Theo Các Hướng (Adjacent Structures)
            </h2>
          </div>
          <InfoPopover title="Hướng dẫn khảo sát tiếp xúc công trình liền kề">
            <p className="leading-relaxed">
              Khảo sát các mặt tiếp giáp với công trình xung quanh nhằm đánh giá nguy cơ ảnh hưởng va đập, kẹt lún hoặc lún kéo theo khi tuyến Metro thi công đào hở hoặc khiên đào ngầm TBM.
            </p>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Trái */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Bên Trái (Nhìn từ ngoài vào)</span>
            </span>
            <Select
              value={formData.adjacentBuildings.left.details}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    left: { ...formData.adjacentBuildings.left, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_LEFT_RIGHT.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {/* Phải */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span>Bên Phải (Nhìn từ ngoài vào)</span>
            </span>
            <Select
              value={formData.adjacentBuildings.right.details}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    right: { ...formData.adjacentBuildings.right, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_LEFT_RIGHT.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {/* Sau */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <ArrowDown className="w-4 h-4 text-slate-500" />
              <span>Phía Sau Nhà</span>
            </span>
            <Select
              value={formData.adjacentBuildings.back.details}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    back: { ...formData.adjacentBuildings.back, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_REAR.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </div>
      </Card>

      {/* 1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Camera className="w-5 h-5 text-purple-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* P-01 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-01: Biển Số Nhà / Biển Tên Cơ Quan *"
              value={formData.photoP01.url}
              onChange={(url) => updateFormData({ photoP01: { ...formData.photoP01, url, notApplicable: false } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP01.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP01: { ...formData.photoP01, notApplicable, url: notApplicable ? '' : formData.photoP01.url } })
              }
            />
          </div>

          {/* P-02 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-02: Mặt Đứng Chính Diện (Facade Overview) *"
              value={formData.photoP02.url}
              onChange={(url) => updateFormData({ photoP02: { ...formData.photoP02, url, notApplicable: false } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP02.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP02: { ...formData.photoP02, notApplicable, url: notApplicable ? '' : formData.photoP02.url } })
              }
            />
            {formData.photoP02.url && !formData.photoP02.notApplicable && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Maximize2 className="w-3.5 h-3.5" />}
                  onClick={() => setIsDrawingPolygon(true)}
                >
                  {formData.photoP02.polygonPoints.length > 0
                    ? `Đã vẽ đa giác (${formData.photoP02.polygonPoints.length} góc) - Sửa lại`
                    : '🔴 Chấm góc bao đa giác & Line phân tầng'}
                </Button>
              </div>
            )}
          </div>

          {/* P-03 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-03: Mặt Bên / Mặt Sau Tiếp Cận *"
              value={formData.photoP03.url}
              onChange={(url) => updateFormData({ photoP03: { ...formData.photoP03, url, notApplicable: false } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP03.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP03: { ...formData.photoP03, notApplicable, url: notApplicable ? '' : formData.photoP03.url } })
              }
            />
            {formData.photoP03.url && !formData.photoP03.notApplicable && (
              <div className="mt-2.5">
                <Select
                  label="Vị trí mặt tiếp cận:"
                  value={formData.photoP03.tag || P03_TAGS[0]}
                  onChange={(e) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, tag: e.target.value },
                    })
                  }
                  options={P03_TAGS.map((t) => ({ value: t, label: t }))}
                />
              </div>
            )}
          </div>

          {/* P-04 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-04: Bối Cảnh Tổng Thể Tuyến Đường / Ngõ *"
              value={formData.photoP04.url}
              onChange={(url) => updateFormData({ photoP04: { ...formData.photoP04, url, notApplicable: false } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP04.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP04: { ...formData.photoP04, notApplicable, url: notApplicable ? '' : formData.photoP04.url } })
              }
            />
          </div>
        </div>
      </Card>

      {/* 1.6. Khảo sát trực quan Lún chênh & Nghiêng ngoài nhà */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.6. Khảo Sát Trực Quan Lún Chênh & Nghiêng Công Trình Ngoài Nhà
          </h2>
        </div>

        <div className="space-y-5">
          {/* Lún Chênh */}
          <LevelSelectorWithGuide
            title="1. Lún Chênh Quan Sát Ngoài Nhà / Tầng Trệt"
            selectedLevel={formData.settlementTilt?.diffSettlement?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...formData.settlementTilt,
                  diffSettlement: {
                    ...formData.settlementTilt.diffSettlement,
                    level,
                  },
                },
              })
            }
            options={SETTLEMENT_LEVEL_OPTIONS}
          >
            <Input
              label="Vị trí cụ thể phát hiện lún chênh (nếu có)"
              placeholder="VD: Chân móng góc trước bên phải tiếp giáp vỉa hè..."
              value={formData.settlementTilt?.diffSettlement?.position || ''}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...formData.settlementTilt,
                    diffSettlement: {
                      ...formData.settlementTilt.diffSettlement,
                      position: e.target.value,
                    },
                  },
                })
              }
            />
          </LevelSelectorWithGuide>

          {/* Nghiêng Công Trình */}
          <LevelSelectorWithGuide
            title="2. Độ Nghiêng Công Trình (Mặt tiền / Khối nhà)"
            selectedLevel={formData.settlementTilt?.buildingTilt?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...formData.settlementTilt,
                  buildingTilt: {
                    ...formData.settlementTilt.buildingTilt,
                    level,
                  },
                },
              })
            }
            options={TILT_LEVEL_OPTIONS}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Độ nghiêng phương X (‰)"
                type="number"
                step="0.1"
                placeholder="VD: 3.5"
                value={formData.settlementTilt?.buildingTilt?.xPermille ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      buildingTilt: {
                        ...formData.settlementTilt.buildingTilt,
                        xPermille: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
              />
              <Input
                label="Độ nghiêng phương Y (‰)"
                type="number"
                step="0.1"
                placeholder="VD: 1.8"
                value={formData.settlementTilt?.buildingTilt?.yPermille ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      buildingTilt: {
                        ...formData.settlementTilt.buildingTilt,
                        yPermille: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
              />
            </div>
          </LevelSelectorWithGuide>

          {/* Nguồn xác định dữ liệu */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Nguồn Xác Định Dữ Liệu Ngoại Quan (Multi-select)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DATA_SOURCES.map((src) => {
                const isChecked = formData.settlementTilt.dataSource.includes(src);
                return (
                  <label
                    key={src}
                    className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const cur = formData.settlementTilt.dataSource;
                        const next = e.target.checked
                          ? [...cur, src]
                          : cur.filter((s) => s !== src);
                        updateFormData({
                          settlementTilt: {
                            ...formData.settlementTilt,
                            dataSource: next,
                          },
                        });
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{src}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Polygon Drawing Modal - Full Screen */}
      {isDrawingPolygon && formData.photoP02.url && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col p-3 sm:p-5 animate-in fade-in">
          <div className="flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Vẽ Đa Giác Bao Mặt Đứng & Đường Phân Tầng (Ảnh P-02)
              </h3>
              <p className="text-xs text-slate-400">
                Chấm các đỉnh góc nhà để tính diện tích bao và kéo đường phân tầng
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setIsDrawingPolygon(false)}>
              Đóng lại
            </Button>
          </div>
          <div className="flex-1 overflow-hidden mt-3">
            <FacadePolygonCanvas
              imageUrl={formData.photoP02.url}
              polygonPoints={formData.photoP02.polygonPoints}
              floorSplitLines={formData.photoP02.floorSplits}
              onChange={(points, splitLines) => {
                updateFormData({
                  photoP02: {
                    ...formData.photoP02,
                    polygonPoints: points,
                    floorSplits: splitLines,
                  },
                });
              }}
              onSave={(data) => {
                updateFormData({
                  photoP02: {
                    ...formData.photoP02,
                    polygonPoints: data.polygonPoints,
                    floorSplits: data.splitLines,
                  },
                });
                setIsDrawingPolygon(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        {isAbsentee ? (
          <>
            <div className="text-xs text-slate-500">
              {completeness.isFullyComplete ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành đủ 100% Bước 1. Sẵn sàng nộp báo cáo vắng.
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  ⚠️ Chưa đủ điều kiện nộp: Vui lòng hoàn thành các trường bắt buộc có dấu *.
                </span>
              )}
            </div>

            <Button
              variant="danger"
              size="lg"
              disabled={!completeness.isFullyComplete || isSubmittingAbsentee}
              onClick={handleSubmitAbsentee}
              icon={<Send className="w-4 h-4" />}
            >
              {isSubmittingAbsentee
                ? 'Đang gửi báo cáo...'
                : '🚀 Nộp Báo Cáo Vắng Nhà Về Server'}
            </Button>
          </>
        ) : (
          <>
            <div className="text-xs text-slate-500">
              Bước 1 / 9: Định danh công trình & Ngoại quan
            </div>
            <Button size="lg" onClick={nextStep}>
              Tiếp tục: Bước 2 (Phỏng vấn chủ hộ) ➔
            </Button>
          </>
        )}
      </div>

      {/* Success Modal for Absentee Submission */}
      {showAbsenteeSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Nộp Thành Công Báo Cáo Vắng Nhà!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dữ liệu ngoại quan công trình <strong>{formData.houseNumber} {formData.street}</strong> đã được ghi nhận và đồng bộ lên hệ thống máy chủ phục vụ lưu trữ hiện trạng pháp lý.
            </p>
            <div className="pt-2">
              <Button
                size="md"
                className="w-full"
                onClick={() => {
                  setShowAbsenteeSuccessModal(false);
                  clearDraft();
                  window.location.reload();
                }}
              >
                Hoàn tất khảo sát
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
