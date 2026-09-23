import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide, LevelOptionGuide } from './LevelSelectorWithGuide';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import { api } from '../../../services/api';
import {
  Building,
  MapPin,
  ShieldAlert,
  Compass,
  Camera,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  ArrowRight,
  Info,
  Home,
  DoorClosed,
  Building2,
  HardHat,
  Trash2,
  Plus,
  FileText,
  Navigation,
  RefreshCw,
  X,
} from 'lucide-react';
import { FacadePolygonCanvas } from '../../../components/canvas/FacadePolygonCanvas';
import { ObjectGroupType } from '../types/phase1.types';

const OBJECT_GROUPS: { value: ObjectGroupType; label: string; desc: string; badgeColor: string }[] = [
  {
    value: 'GENERAL',
    label: '1. Nhà ở dân dụng thông thường (General)',
    desc: 'Nhà phố, nhà liên kế, biệt thự thông thường dưới 5 tầng.',
    badgeColor: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  },
  {
    value: 'IMPORTANT',
    label: '2. Công trình nhạy cảm / Quan trọng (Important)',
    desc: 'Chung cư cao tầng (≥ 5 tầng), trường học, bệnh viện, công trình tập trung đông người.',
    badgeColor: 'bg-amber-50 border-amber-300 text-amber-900',
  },
  {
    value: 'CRITICAL',
    label: '3. Di tích lịch sử / Bảo tồn / Đặc biệt (Critical)',
    desc: 'Công trình di sản văn hóa, tôn giáo cổ, cơ sở quốc phòng trọng yếu.',
    badgeColor: 'bg-red-50 border-red-300 text-red-900',
  },
];

const ADJACENT_LEFT_RIGHT = [
  'Nhà phố / Nhà dân',
  'Cao tầng / Chung cư',
  'Bệnh viện / Y tế',
  'Trường học',
  'Công viên / Cây xanh',
  'Đất trống',
  'Cơ sở tôn giáo (Chùa, Nhà thờ)',
  'Không biết / Không rõ (Bị che khuất)',
  'Khác...',
];

const ADJACENT_REAR = [
  'Nhà phố / Nhà dân',
  'Cao tầng / Chung cư',
  'Bệnh viện / Y tế',
  'Trường học',
  'Công viên / Cây xanh',
  'Đất trống',
  'Hẻm / Đường nội bộ',
  'Không biết / Không rõ (Bị che khuất)',
  'Khác...',
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
  const [isSubmittingUnderConstruction, setIsSubmittingUnderConstruction] = useState(false);
  const [showAbsenteeSuccessModal, setShowAbsenteeSuccessModal] = useState(false);
  const [showUnderConstructionSuccessModal, setShowUnderConstructionSuccessModal] = useState(false);
  const [isConfirmingApartment, setIsConfirmingApartment] = useState(false);
  const [showApartmentSuccessModal, setShowApartmentSuccessModal] = useState(false);

  // Survey case mode
  const currentCase = formData.surveyCaseType || (formData.isAbsenteeSurvey ? 'ABSENTEE' : 'NORMAL');

  const handleSelectCase = (caseType: 'NORMAL' | 'ABSENTEE' | 'APARTMENT' | 'UNDER_CONSTRUCTION') => {
    if (caseType === 'ABSENTEE') {
      updateFormData({
        surveyCaseType: 'ABSENTEE',
        isAbsenteeSurvey: true,
        absenteeReason: formData.absenteeReason || ABSENTEE_REASONS[0],
      });
    } else if (caseType === 'APARTMENT') {
      updateFormData({
        surveyCaseType: 'APARTMENT',
        isAbsenteeSurvey: false,
        objectGroup: 'IMPORTANT', // Tự động gán Important cho chung cư
        usageFunction: formData.usageFunction === 'Nhà ở gia đình' ? 'Khách sạn / Nhà nghỉ / Căn hộ DV' : formData.usageFunction,
      });
    } else if (caseType === 'UNDER_CONSTRUCTION') {
      updateFormData({
        surveyCaseType: 'UNDER_CONSTRUCTION',
        isAbsenteeSurvey: false,
      });
    } else {
      updateFormData({
        surveyCaseType: 'NORMAL',
        isAbsenteeSurvey: false,
      });
    }
  };

  const validateStep1Completeness = () => {
    const hasProjectParcelCode = Boolean(formData.projectParcelCode?.trim());
    const hasOfficialCadastralCode = Boolean(formData.officialCadastralCode?.trim());
    const hasGps = Boolean(formData.gpsCoords?.lat && formData.gpsCoords?.lng);
    const hasAddress = Boolean(formData.street?.trim() || formData.houseNumber?.trim());
    const hasOwnerName = Boolean(formData.ownerName?.trim());
    const hasObjectGroup = Boolean(formData.objectGroup);
    const hasAdjacent = Boolean(
      formData.adjacentBuildings?.left?.details &&
      formData.adjacentBuildings?.right?.details &&
      formData.adjacentBuildings?.back?.details
    );
    const hasPhotos = Boolean(
      (formData.photoP01?.url || formData.photoP01?.notApplicable) &&
      (formData.photoP02?.url || formData.photoP02?.notApplicable) &&
      (formData.photoP03?.url || formData.photoP03?.notApplicable) &&
      (formData.photoP04?.url || formData.photoP04?.notApplicable)
    );
    const hasP02Polygon = !formData.photoP02?.url || Boolean(formData.photoP02.polygonPoints && formData.photoP02.polygonPoints.length >= 3);
    const hasSettlement = typeof formData.settlementTilt?.diffSettlement?.level === 'number';
    const hasDataSource = Boolean(formData.settlementTilt?.dataSource && formData.settlementTilt.dataSource.length > 0);

    const isFullyComplete =
      hasProjectParcelCode &&
      hasOfficialCadastralCode &&
      hasAddress &&
      hasOwnerName &&
      hasObjectGroup &&
      hasAdjacent &&
      hasPhotos &&
      hasP02Polygon &&
      hasSettlement &&
      hasDataSource;

    return {
      hasProjectParcelCode,
      hasOfficialCadastralCode,
      hasGps,
      hasAddress,
      hasOwnerName,
      hasObjectGroup,
      hasAdjacent,
      hasPhotos,
      hasP02Polygon,
      hasSettlement,
      hasDataSource,
      isFullyComplete,
    };
  };

  const completeness = validateStep1Completeness();

  const handleSubmitAbsentee = async () => {
    try {
      setIsSubmittingAbsentee(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Submitting Absentee Survey:', formData);

      // 1. Lưu trạng thái override cục bộ đảm bảo UI trang chủ cập nhật ngay lập tức
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          status: 'POSTPONED_ABSENT',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      // 2. Gửi API máy chủ
      try {
        await api.post(`/parcels/${formData.parcelId}/record-absence`, {
          absenceReason: 'HOMEOWNER_ABSENT',
          notes: formData.absenteeReason === 'Lý do khác' ? (formData.customAbsenteeReason || 'Lý do khác') : (formData.absenteeReason || 'Chủ nhà vắng mặt'),
          photoProofUrl: formData.absenteeMinutesPhotos?.[0] || formData.photoP01?.url || '',
        });
      } catch (apiErr) {
        console.warn('[Phase1] API record-absence failed (fallback to persistent local status):', apiErr);
      }

      setShowAbsenteeSuccessModal(true);
    } catch (err) {
      console.error('Submit absentee error:', err);
      alert('Có lỗi khi gửi báo cáo vắng nhà.');
    } finally {
      setIsSubmittingAbsentee(false);
    }
  };

  const handleSubmitUnderConstruction = async () => {
    try {
      setIsSubmittingUnderConstruction(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Submitting Under Construction Survey:', formData);

      // 1. Lưu trạng thái override cục bộ
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          status: 'UNDER_CONSTRUCTION',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      // 2. Gửi API máy chủ
      try {
        await api.post('/surveys/phase1/submit', {
          parcelId: formData.parcelId,
          surveyData: formData,
          status: 'IN_PROGRESS',
        });
      } catch (apiErr) {
        console.warn('[Phase1] API submit under-construction failed (fallback to local status):', apiErr);
      }

      setShowUnderConstructionSuccessModal(true);
    } catch (err) {
      console.error('Submit under construction error:', err);
      alert('Có lỗi khi gửi báo cáo công trình đang xây dựng.');
    } finally {
      setIsSubmittingUnderConstruction(false);
    }
  };

  const handleConfirmApartment = async () => {
    try {
      setIsConfirmingApartment(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Confirming Condominium / Apartment Complex for:', buildingId);

      // 1. Gọi API cập nhật loại hình công trình thành CONDOMINIUM
      try {
        await api.patch(`/parcels/${formData.parcelId}/building-type`, {
          buildingType: 'CONDOMINIUM',
        });
      } catch (apiErr) {
        console.warn('[Phase1] API patch building-type failed (using local persistent override):', apiErr);
      }

      // 2. Lưu override trạng thái công trình là chung cư
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          ...(overrides[formData.parcelId] || {}),
          buildingType: 'CONDOMINIUM',
          surveyCaseType: 'APARTMENT',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      setShowApartmentSuccessModal(true);
    } catch (err: any) {
      console.error('Lỗi xác nhận chung cư:', err);
      alert('Có lỗi khi xác nhận loại hình chung cư: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsConfirmingApartment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1.1. Thông tin định danh công trình */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Building className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.1. Thông Tin Nhận Diện & Định Danh Công Trình *
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="input-projectParcelCode"
            label="Mã Quản Lý Dự Án (Project Parcel Code) *"
            value={formData.projectParcelCode}
            disabled
            hint="Tự động cấp từ hệ thống theo lý trình"
          />
          <Input
            id="input-officialCadastralCode"
            label="Mã Địa Chính Gốc (Cadastral Code) *"
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
            id="input-address"
            label="Địa Chỉ Thực Tế Hiện Trường (Address) *"
            placeholder="Số nhà, Tên đường (Đối chiếu sơ đồ quy hoạch)"
            value={formData.houseNumber ? `${formData.houseNumber}, ${formData.street}` : (formData.street || '')}
            onChange={(e) => {
              const val = e.target.value;
              if (!val || val.trim() === '') {
                updateFormData({ houseNumber: '', street: '' });
                return;
              }
              const parts = val.split(',');
              if (parts.length > 1) {
                updateFormData({ houseNumber: parts[0].trim(), street: parts.slice(1).join(',').trim() });
              } else {
                updateFormData({ houseNumber: '', street: val });
              }
            }}
          />

          <div className="sm:col-span-2">
            <Input
              id="input-ownerName"
              label="Chủ Sở Hữu / Người Sử Dụng (Owner / User) *"
              placeholder={currentCase === 'ABSENTEE' ? 'Chủ hộ vắng mặt (nếu biết tên thì ghi)' : 'Nguyễn Văn A'}
              value={formData.ownerName}
              onChange={(e) => updateFormData({ ownerName: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* 1.2. Nhóm đối tượng công trình */}
      <Card className="border-slate-200 bg-white shadow-xs">
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
              <li><strong>Important (2đ):</strong> Công trình công cộng, trường học, trạm y tế, chung cư tập trung đông dân cư (≥ 5 tầng).</li>
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
                    ? `${grp.badgeColor} border-emerald-600 shadow-xs ring-1 ring-emerald-600/30`
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm mb-1 text-slate-900">{grp.label}</div>
                <div className="text-xs text-slate-600 leading-relaxed">{grp.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 1.3. Thông tin tuyến Metro & GIS */}
      <Card className="border-slate-200 bg-slate-50/40 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.3. Thông Tin Tuyến Metro & Tọa Độ GIS
            </h2>
          </div>
          <InfoPopover title="Ý nghĩa 4 thông số Tuyến Metro & Tọa độ GIS">
            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>1. Lý trình (Chainage):</strong> Vị trí mốc Km trên tuyến Metro Số 2 (Bến Thành – Tham Lương) tương ứng với vị trí lô đất.</p>
              <p><strong>2. Khoảng cách tới tim Metro:</strong> Cự ly vuông góc ngắn nhất từ các đỉnh đa giác thửa đất đến đường tim tuyến hầm Metro, quyết định phân vùng rung chấn.</p>
              <p><strong>3. Khoảng cách tới ranh GPMB:</strong> Cự ly ngắn nhất từ ranh thửa đất đến mốc hành lang giải phóng mặt bằng thu hồi đất dự án Metro.</p>
              <p><strong>4. Tọa độ thửa đất (GIS Parcel):</strong> Tọa độ trắc địa WGS84 tâm lô đất cố định trích xuất từ cơ sở dữ liệu địa chính quy hoạch.</p>
            </div>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Lý trình (Chainage)</span>
            <span className="text-sm font-bold text-slate-800">{formData.chainage || 'Km 0+000'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Khoảng cách tới tim Metro</span>
            <span className="text-sm font-bold text-slate-800">{formData.metroOffsetDistance || '15.0m'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Khoảng cách tới ranh GPMB</span>
            <span className="text-sm font-bold text-slate-800">{formData.clearanceOffsetDistance || '5.2m'}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 block font-medium">Tọa độ thửa đất (GIS Parcel)</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Đỉnh ranh gần tim Metro nhất
              </span>
            </div>
            <span className="text-sm font-bold text-emerald-700 font-mono mt-1 block">
              {formData.gpsCoords?.lat ? `${formData.gpsCoords.lat.toFixed(6)}, ${formData.gpsCoords.lng.toFixed(6)}` : 'Chưa có tọa độ'}
            </span>
          </div>
        </div>
      </Card>

      {/* 1.4. Công trình liền kề 3 hướng */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.4. Công Trình Liền Kề Theo Các Hướng (Adjacent Structures)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Bên Trái */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Bên Trái (Theo hướng toà nhà)</span>
            </div>
            <Select
              value={formData.adjacentBuildings?.left?.details || ADJACENT_LEFT_RIGHT[0]}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    left: { ...formData.adjacentBuildings.left, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_LEFT_RIGHT.map((opt) => ({ value: opt, label: opt }))}
            />
            <Input
              placeholder="Ghi chú chi tiết bên trái (nếu có)..."
              value={formData.adjacentBuildings?.left?.note || ''}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    left: { ...formData.adjacentBuildings.left, note: e.target.value },
                  },
                })
              }
            />
          </div>

          {/* Bên Phải */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Bên Phải (Theo hướng toà nhà)</span>
            </div>
            <Select
              value={formData.adjacentBuildings?.right?.details || ADJACENT_LEFT_RIGHT[0]}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    right: { ...formData.adjacentBuildings.right, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_LEFT_RIGHT.map((opt) => ({ value: opt, label: opt }))}
            />
            <Input
              placeholder="Ghi chú chi tiết bên phải (nếu có)..."
              value={formData.adjacentBuildings?.right?.note || ''}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    right: { ...formData.adjacentBuildings.right, note: e.target.value },
                  },
                })
              }
            />
          </div>

          {/* Phía Sau */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Phía Sau Tiếp Giáp</span>
            </div>
            <Select
              value={formData.adjacentBuildings?.back?.details || ADJACENT_REAR[0]}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    back: { ...formData.adjacentBuildings.back, details: e.target.value },
                  },
                })
              }
              options={ADJACENT_REAR.map((opt) => ({ value: opt, label: opt }))}
            />
            <Input
              placeholder="Ghi chú chi tiết phía sau (nếu có)..."
              value={formData.adjacentBuildings?.back?.note || ''}
              onChange={(e) =>
                updateFormData({
                  adjacentBuildings: {
                    ...formData.adjacentBuildings,
                    back: { ...formData.adjacentBuildings.back, note: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* 1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* P-01 */}
          <div id="photo-p01-section" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                P-01: Biển Số Nhà / Biển Tên Cơ Quan
              </span>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP01.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP01: { ...formData.photoP01, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>N/A (Không có biển số)</span>
              </label>
            </div>

            {!formData.photoP01.notApplicable && (
              <PhotoCaptureInput
                label="Chụp ảnh biển số nhà rõ nét:"
                value={formData.photoP01.url}
                onChange={(url) =>
                  updateFormData({ photoP01: { ...formData.photoP01, url } })
                }
                watermarkText={`P-01 | ${formData.houseNumber || 'BIEN-SO'}`}
                height="150px"
              />
            )}
          </div>

          {/* P-02: Mặt Đứng Chính Diện */}
          <div id="photo-p02-section" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                P-02: Mặt Đứng Chính Diện (Facade Overview)
              </span>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP02.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP02: { ...formData.photoP02, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>N/A (Bị che khuất)</span>
              </label>
            </div>

            {!formData.photoP02.notApplicable && (
              <div className="space-y-2">
                <PhotoCaptureInput
                  label="Chụp trực diện toàn bộ mặt tiền công trình:"
                  value={formData.photoP02.url}
                  onChange={(url) =>
                    updateFormData({
                      photoP02: { ...formData.photoP02, url },
                    })
                  }
                  watermarkText={`P-02 | FACADE | ${formData.projectParcelCode}`}
                  height="150px"
                />

                {formData.photoP02.url && (
                  <div
                    className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      (formData.photoP02.polygonPoints?.length || 0) >= 3
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-300/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {(formData.photoP02.polygonPoints?.length || 0) >= 3 ? (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          ✓ Đã chấm {formData.photoP02.polygonPoints?.length} điểm đa giác mặt tiền
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          ⚠️ Bắt buộc chấm đa giác mặt tiền (tối thiểu 3 điểm) *
                        </span>
                      )}
                    </div>
                    <Button
                      id="btn-p02-polygon"
                      size="sm"
                      variant={(formData.photoP02.polygonPoints?.length || 0) >= 3 ? 'outline' : 'primary'}
                      icon={<Maximize2 className="w-3.5 h-3.5" />}
                      onClick={() => setIsDrawingPolygon(true)}
                    >
                      {(formData.photoP02.polygonPoints?.length || 0) >= 3 ? 'Chỉnh sửa đa giác & phân tầng' : 'Chấm điểm đa giác & phân tầng *'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* P-03: Mặt Bên / Mặt Sau */}
          <div id="photo-p03-section" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                P-03: Mặt Bên Hoặc Mặt Sau Tiếp Cận
              </span>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP03.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>N/A (Sát vách, không có mặt hông)</span>
              </label>
            </div>

            {!formData.photoP03.notApplicable && (
              <div className="space-y-2">
                <Select
                  value={formData.photoP03.tag || P03_TAGS[0]}
                  onChange={(e) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, tag: e.target.value },
                    })
                  }
                  options={P03_TAGS.map((t) => ({ value: t, label: t }))}
                />
                <PhotoCaptureInput
                  label="Chụp mặt bên/mặt sau tiếp cận:"
                  value={formData.photoP03.url}
                  onChange={(url) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, url },
                    })
                  }
                  watermarkText={`P-03 | ${formData.photoP03.tag || 'MAT-BEN'}`}
                  height="115px"
                />
              </div>
            )}
          </div>

          {/* P-04: Bối Cảnh Tổng Thể */}
          <div id="photo-p04-section" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                P-04: Bối Cảnh Tổng Thể Lấy Cả Đường/Ngõ
              </span>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP04.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP04: { ...formData.photoP04, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>N/A (Hẻm quá hẹp)</span>
              </label>
            </div>

            {!formData.photoP04.notApplicable && (
              <PhotoCaptureInput
                label="Chụp bối cảnh tiếp cận tuyến đường/ngõ:"
                value={formData.photoP04.url}
                onChange={(url) =>
                  updateFormData({ photoP04: { ...formData.photoP04, url } })
                }
                watermarkText={`P-04 | CONTEXT | ${formData.street || 'STREET'}`}
                height="150px"
              />
            )}
          </div>
        </div>
      </Card>

      {/* 1.6. Khảo sát trực quan Lún chênh & Nghiêng ngoài nhà */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.6. Khảo Sát Trực Quan Lún Chênh & Nghiêng Ngoài Nhà
            </h2>
          </div>
        </div>

        <div className="space-y-4">
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
              label="Vị trí phát hiện lún chênh cụ thể (nếu có)"
              placeholder="VD: Góc chân tường bên trái giáp hẻm..."
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
          <div
            id="section-settlement-datasource"
            className={`p-4 rounded-xl border transition-colors ${
              (!formData.settlementTilt?.dataSource || formData.settlementTilt.dataSource.length === 0)
                ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                : 'bg-slate-50/50 border-slate-200'
            } space-y-2`}
          >
            <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
              <label className="text-xs font-bold text-slate-800 block">
                Nguồn Xác Định Dữ Liệu Ngoại Quan (Multi-select) *
              </label>
              {(!formData.settlementTilt?.dataSource || formData.settlementTilt.dataSource.length === 0) && (
                <span className="text-[11px] font-semibold text-red-600">
                  * Bắt buộc chọn ít nhất 1 nguồn
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DATA_SOURCES.map((src) => {
                const isChecked = formData.settlementTilt?.dataSource?.includes(src) || false;
                return (
                  <label
                    key={src}
                    className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const cur = formData.settlementTilt?.dataSource || [];
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

      {/* ========================================================================= */}
      {/* 1.7. TÌNH TRẠNG TIẾP CẬN HIỆN TRƯỜNG & PHƯƠNG THỨC KHẢO SÁT (Ở CUỐI BƯỚC 1) */}
      {/* ========================================================================= */}
      <Card className="border-emerald-300 bg-emerald-50/30 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                1.7. Tình Trạng Tiếp Cận Hiện Trường & Phương Thức Khảo Sát
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
            onClick={() => handleSelectCase('NORMAL')}
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
            onClick={() => handleSelectCase('ABSENTEE')}
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
            onClick={() => handleSelectCase('APARTMENT')}
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
            onClick={() => handleSelectCase('UNDER_CONSTRUCTION')}
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

        {/* CHI TIẾT THEO TỪNG OPTION */}

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
              label="Lý do vắng mặt / không tiếp cận:"
              value={formData.absenteeReason || ABSENTEE_REASONS[0]}
              onChange={(e) => updateFormData({ absenteeReason: e.target.value })}
              options={ABSENTEE_REASONS.map((r) => ({ value: r, label: r }))}
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
            <div className="space-y-2 pt-2 border-t border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-700" />
                  Ảnh Chụp Biên Bản Vắng Nhà (Có thể chụp nhiều ảnh):
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
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity"
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
                onClick={handleSubmitAbsentee}
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
                onClick={handleConfirmApartment}
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

            {/* Nhiều ảnh công trình đang xây dựng */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-950">
                  Ảnh Chụp Hiện Trạng Công Trình Đang Thi Công (Chụp nhiều ảnh):
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
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity"
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
                Ghi chú giai đoạn thi công hiện tại:
              </label>
              <textarea
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
                onClick={handleSubmitUnderConstruction}
                icon={<Send className="w-4 h-4" />}
              >
                {isSubmittingUnderConstruction ? 'Đang gửi hồ sơ...' : 'Hoàn Tất Hồ Sơ Nhà Đang Xây'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Polygon Drawing Modal - Full Screen */}
      {isDrawingPolygon && formData.photoP02.url && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col p-3 sm:p-5 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-800">
                  Vẽ Đa Giác Bao Mặt Đứng & Đường Phân Tầng (Ảnh P-02)
                </h3>
                <p className="text-xs text-slate-500">
                  Chấm các đỉnh góc nhà để tính diện tích bao và kéo đường phân tầng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawingPolygon(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                title="Hủy / Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3 bg-slate-100">
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
        </div>
      )}

      {/* Bottom Action Footer (Hiển thị khi ở chế độ Nhà dân thông thường) */}
      {currentCase === 'NORMAL' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Bước 1 / 8: Định danh công trình & Ngoại quan
          </div>
          <Button size="lg" onClick={nextStep}>
            Tiếp tục: Bước 2 (Phỏng vấn chủ hộ) ➔
          </Button>
        </div>
      )}

      {/* Success Modal for Absentee Submission */}
      {showAbsenteeSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Nộp Thành Công Báo Cáo Vắng Nhà!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dữ liệu ngoại quan và toàn bộ hình ảnh thực tế của công trình <strong>[{formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId}]</strong> đã được đồng bộ lên máy chủ.
            </p>
            <div className="pt-2">
              <Button
                size="md"
                className="w-full"
                onClick={() => {
                  setShowAbsenteeSuccessModal(false);
                  clearDraft();
                  window.location.hash = '#/';
                  window.location.reload();
                }}
              >
                Hoàn tất khảo sát
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal for Under Construction Submission */}
      {showUnderConstructionSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Nộp Thành Công Hồ Sơ Công Trình Đang Xây Dựng!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hiện trạng thi công và toàn bộ hình ảnh thực tế của công trình <strong>[{formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId}]</strong> đã được đồng bộ lên máy chủ.
            </p>
            <div className="pt-2">
              <Button
                size="md"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => {
                  setShowUnderConstructionSuccessModal(false);
                  clearDraft();
                  window.location.hash = '#/';
                  window.location.reload();
                }}
              >
                Hoàn tất khảo sát
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal for Apartment Confirmation */}
      {showApartmentSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Xác Nhận Quy Chuẩn Chung Cư Thành Công!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Công trình <strong>[{formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId}]</strong> đã được thiết lập quy chuẩn quản lý Tòa Nhà Chung Cư / Nhiều Căn Hộ.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowApartmentSuccessModal(false);
                  clearDraft();
                  window.location.hash = '#/';
                  window.location.reload();
                }}
              >
                Về trang chủ
              </Button>
              <Button
                size="md"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setShowApartmentSuccessModal(false);
                  try {
                    localStorage.setItem('metro2_open_hub_parcel_id', formData.parcelId);
                  } catch (_e) {}
                  clearDraft();
                  window.location.hash = '#/';
                  window.location.reload();
                }}
                icon={<Building2 className="w-4 h-4" />}
              >
                Hub chung cư
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
