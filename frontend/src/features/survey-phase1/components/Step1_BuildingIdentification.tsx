import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { FacadePolygonCanvas } from '../../../components/canvas/FacadePolygonCanvas';
import { ObjectGroupType } from '../types/phase1.types';
import { Building, MapPin, Compass, Camera, Maximize2, ShieldAlert } from 'lucide-react';

const OBJECT_GROUPS: { value: ObjectGroupType; label: string; desc: string; badgeColor: string }[] = [
  {
    value: 'GENERAL',
    label: '1. General (Thông thường)',
    desc: 'Nhà ở riêng lẻ, nhà phố liên kế, cửa hàng dịch vụ quy mô vừa/nhỏ.',
    badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    value: 'IMPORTANT',
    label: '2. Important (Quan trọng)',
    desc: 'Trường học, mầm non, bệnh viện/phòng khám, chung cư, trụ sở công quyền.',
    badgeColor: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    value: 'CRITICAL',
    label: '3. Critical (Trọng yếu)',
    desc: 'Di tích lịch sử, bảo tàng, hạ tầng nhạy cảm ngầm cao nguyên giá.',
    badgeColor: 'border-red-200 bg-red-50 text-red-800',
  },
];

const ADJACENT_PRESETS = [
  'Nhà phố bê tông 3-5 tầng',
  'Nhà phố cấp 4 / mái tôn',
  'Tòa nhà cao tầng / Văn phòng',
  'Trường học / Công trình công cộng',
  'Đất trống / Hẻm kỹ thuật / Rãnh thoát',
  'Khác...',
];

export const Step1_BuildingIdentification: React.FC = () => {
  const { formData, updateFormData, nextStep } = usePhase1SurveyStore();
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Thông tin định danh công trình */}
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
            hint="Tự động cấp từ hệ thống"
          />
          <Input
            label="Mã Địa Chính Gốc (Cadastral Code)"
            value={formData.officialCadastralCode}
            disabled
            hint="Trích xuất từ bản đồ địa chính PostGIS"
          />

          <Input
            label="Tên Công Trình / Biển Hiệu Riêng"
            placeholder="VD: Cửa hàng Bách Hóa Xanh / Nhà thuốc Long Châu..."
            value={formData.buildingName}
            onChange={(e) => updateFormData({ buildingName: e.target.value })}
          />

          <Input
            label="Số Nhà Thực Tế Hiện Trường"
            value={formData.houseNumber}
            onChange={(e) => updateFormData({ houseNumber: e.target.value })}
          />

          <Input
            label="Tên Tuyến Đường / Phố"
            value={formData.street}
            onChange={(e) => updateFormData({ street: e.target.value })}
          />

          <Input
            label="Họ & Tên Chủ Sở Hữu / Người Đại Diện"
            value={formData.ownerName}
            onChange={(e) => updateFormData({ ownerName: e.target.value })}
          />

          <Input
            label="Số Điện Thoại Liên Hệ"
            placeholder="09xx xxx xxx"
            value={formData.ownerPhone}
            onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
          />
        </div>
      </Card>

      {/* 2. Nhóm đối tượng công trình */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.2. Nhóm Đối Tượng Công Trình (Phục vụ phân cấp rủi ro BRA)
          </h2>
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

      {/* 3. Công trình liền kề 3 hướng */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Compass className="w-5 h-5 text-blue-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.3. Khảo Sát Hiện Trạng Liền Kề 3 Hướng (Trái, Phải, Sau)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Trái */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 block mb-2">⬅️ Bên Trái (Nhìn từ ngoài)</span>
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
              options={ADJACENT_PRESETS.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {/* Phải */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 block mb-2">➡️ Bên Phải (Nhìn từ ngoài)</span>
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
              options={ADJACENT_PRESETS.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {/* Sau */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 block mb-2">⬇️ Phía Sau Nhà</span>
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
              options={ADJACENT_PRESETS.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </div>
      </Card>

      {/* 4. Bộ 4 ảnh định danh P-01 .. P-04 */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Camera className="w-5 h-5 text-purple-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.4. Bộ 4 Ảnh Định Danh Tiêu Chuẩn Hiện Trường (P-01 → P-04)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* P-01 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-01: Ảnh Số Nhà / Biển Tên Công Trình"
              value={formData.photoP01.url}
              onChange={(url) => updateFormData({ photoP01: { ...formData.photoP01, url } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP01.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP01: { ...formData.photoP01, notApplicable } })
              }
            />
          </div>

          {/* P-02 (Mặt đứng chính + Polygon Canvas) */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-02: Mặt Đứng Chính (Facade Overview)"
              value={formData.photoP02.url}
              onChange={(url) => updateFormData({ photoP02: { ...formData.photoP02, url } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP02.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP02: { ...formData.photoP02, notApplicable } })
              }
            />
            {formData.photoP02.url && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Maximize2 className="w-3.5 h-3.5" />}
                  onClick={() => setIsDrawingPolygon(true)}
                >
                  {formData.photoP02.polygonPoints.length > 0
                    ? `Đã vẽ đa giác (${formData.photoP02.polygonPoints.length} điểm) - Sửa lại`
                    : 'Vẽ đa giác ranh mặt tiền & Phân tầng'}
                </Button>
              </div>
            )}
          </div>

          {/* P-03 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-03: Ảnh Tiếp Cận Hông / Sau Nhà"
              value={formData.photoP03.url}
              onChange={(url) => updateFormData({ photoP03: { ...formData.photoP03, url } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP03.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP03: { ...formData.photoP03, notApplicable } })
              }
            />
          </div>

          {/* P-04 */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
            <PhotoCaptureInput
              label="P-04: Bối Cảnh Tổng Thể Tuyến Đường / Láng Giềng"
              value={formData.photoP04.url}
              onChange={(url) => updateFormData({ photoP04: { ...formData.photoP04, url } })}
              allowNotApplicable={true}
              isNotApplicable={formData.photoP04.notApplicable}
              onToggleNotApplicable={(notApplicable) =>
                updateFormData({ photoP04: { ...formData.photoP04, notApplicable } })
              }
            />
          </div>
        </div>
      </Card>

      {/* Polygon Drawing Modal */}
      {isDrawingPolygon && formData.photoP02.url && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col p-4 animate-in fade-in">
          <div className="flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <h3 className="font-bold text-sm sm:text-base">
              Vẽ đa giác bao mặt đứng & Đường phân tầng (P-02)
            </h3>
            <Button variant="danger" size="sm" onClick={() => setIsDrawingPolygon(false)}>
              Đóng lại
            </Button>
          </div>
          <div className="flex-1 overflow-hidden mt-3">
            <FacadePolygonCanvas
              imageUrl={formData.photoP02.url}
              polygonPoints={formData.photoP02.polygonPoints}
              floorSplitLines={formData.photoP02.floorSplits}
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

      {/* Next Step Action */}
      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={nextStep}>
          Tiếp tục: Bước 2 (Phỏng vấn chủ hộ) ➔
        </Button>
      </div>
    </div>
  );
};
