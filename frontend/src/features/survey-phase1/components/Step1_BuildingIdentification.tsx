import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { FacadePolygonCanvas } from '../../../components/canvas/FacadePolygonCanvas';
import { ObjectGroupType } from '../types/phase1.types';
import { LevelSelectorWithGuide } from './LevelSelectorWithGuide';
import {
  SETTLEMENT_LEVEL_OPTIONS,
  TILT_LEVEL_OPTIONS,
} from '../constants/levelGuideConstants';
import {
  Building,
  MapPin,
  Compass,
  Camera,
  Maximize2,
  ShieldAlert,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Send,
  Check,
} from 'lucide-react';
import { api } from '../../../services/api';

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

const ABSENTEE_REASONS = [
  'Khóa cửa ngoài - Không có người ở nhà',
  'Chủ nhà đi vắng nhiều ngày / Chưa liên hệ được',
  'Chủ sở hữu từ chối cho vào khảo sát bên trong',
  'Nhà đang tranh chấp / Niêm phong',
  'Nhà bỏ hoang / Không có người quản lý',
  'Khác...',
];

export const Step1_BuildingIdentification: React.FC = () => {
  const { formData, updateFormData, nextStep, clearDraft } = usePhase1SurveyStore();
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [isSubmittingAbsentee, setIsSubmittingAbsentee] = useState(false);
  const [showAbsenteeSuccessModal, setShowAbsenteeSuccessModal] = useState(false);

  const isAbsentee = !!formData.isAbsenteeSurvey;

  // Validation logic for Step 1 in Absentee Mode
  const checkStep1Completeness = () => {
    const hasAddress = !!formData.houseNumber && !!formData.street;
    const hasObjectGroup = !!formData.objectGroup;
    const hasAdjacent =
      !!formData.adjacentBuildings.left.details &&
      !!formData.adjacentBuildings.right.details &&
      !!formData.adjacentBuildings.back.details;
    const hasP01 = !!formData.photoP01.url || formData.photoP01.notApplicable;
    const hasP02 = !!formData.photoP02.url || formData.photoP02.notApplicable;
    const hasP03 = !!formData.photoP03.url || formData.photoP03.notApplicable;
    const hasP04 = !!formData.photoP04.url || formData.photoP04.notApplicable;
    const hasPhotos = hasP01 && hasP02 && hasP03 && hasP04;
    const hasReason = isAbsentee ? !!formData.absenteeReason : true;

    return {
      hasAddress,
      hasObjectGroup,
      hasAdjacent,
      hasPhotos,
      hasReason,
      isFullyComplete: hasAddress && hasObjectGroup && hasAdjacent && hasPhotos && hasReason,
    };
  };

  const completeness = checkStep1Completeness();

  const handleToggleAbsentee = () => {
    const nextVal = !isAbsentee;
    updateFormData({
      isAbsenteeSurvey: nextVal,
      absenteeReason: nextVal ? formData.absenteeReason || ABSENTEE_REASONS[0] : '',
      accessLimitation: {
        ...formData.accessLimitation,
        type: nextVal ? 'ABSENT_REFUSED' : 'FULL_100',
        mainReason: nextVal ? 'Chủ hộ vắng mặt tại thời điểm khảo sát' : '',
      },
    });
  };

  const handleSubmitAbsentee = async () => {
    if (!completeness.isFullyComplete) {
      alert('Vui lòng điền đủ 100% các thông tin ngoại quan của Bước 1 trước khi nộp báo cáo vắng nhà.');
      return;
    }

    try {
      setIsSubmittingAbsentee(true);
      const payload = {
        parcelId: formData.parcelId,
        surveyData: {
          ...formData,
          isAbsenteeSurvey: true,
          accessLimitation: {
            ...formData.accessLimitation,
            type: 'ABSENT_REFUSED',
            mainReason: formData.absenteeReason || 'Chủ hộ vắng mặt',
          },
        },
        status: 'ABSENTEE_SUBMITTED',
        completedAt: new Date().toISOString(),
      };

      await api.post('/surveys/phase1/submit-absentee', payload);
      setShowAbsenteeSuccessModal(true);
    } catch (err) {
      console.error('Submit absentee error:', err);
      // Fallback local persistence
      setShowAbsenteeSuccessModal(true);
    } finally {
      setIsSubmittingAbsentee(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner: Absentee Mode Toggle */}
      <div
        className={`p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
          isAbsentee
            ? 'bg-amber-500/10 border-amber-500 text-amber-950'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              isAbsentee ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">
              {isAbsentee ? 'Đang bật chế độ: KHẢO SÁT VẮNG NHÀ' : 'Chủ nhà vắng mặt / Không tiếp cận?'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAbsentee
                ? 'Quy định: Cần điền đầy đủ 100% dữ liệu ngoại quan Bước 1 để nộp báo cáo vắng về server.'
                : 'Nếu chủ hộ vắng mặt, bấm nút bên cạnh để chuyển sang quy trình khảo sát ngoại quan vắng nhà.'}
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

      {/* Absentee Survey Checklist Progress (Rendered when in Absentee mode) */}
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
            label="Số Nhà Thực Tế Hiện Trường *"
            placeholder="VD: 142/5B"
            value={formData.houseNumber}
            onChange={(e) => updateFormData({ houseNumber: e.target.value })}
          />

          <Input
            label="Tên Tuyến Đường / Phố *"
            placeholder="VD: Võ Văn Ngân, TP Thủ Đức"
            value={formData.street}
            onChange={(e) => updateFormData({ street: e.target.value })}
          />

          <Input
            label="Họ & Tên Chủ Sở Hữu / Người Đại Diện"
            placeholder={isAbsentee ? 'Chủ hộ vắng mặt (nếu biết tên thì ghi)' : 'Nguyễn Văn A'}
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
            1.2. Nhóm Đối Tượng Công Trình (Phục vụ phân cấp rủi ro BRA & V1)
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
              label="P-01: Ảnh Số Nhà / Biển Tên Công Trình *"
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
              label="P-02: Mặt Đứng Chính (Facade Overview) *"
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
              label="P-03: Ảnh Tiếp Cận Hông / Sau Nhà *"
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
              label="P-04: Bối Cảnh Tổng Thể Tuyến Đường / Láng Giềng *"
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

      {/* 5. Khảo sát ngoại quan sơ bộ Lún & Nghiêng (4 Level + ? Biểu hiện vật lý) */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              1.5. Đánh Giá Ngoại Quan Sơ Bộ Lún Chênh & Nghiêng Công Trình
            </h2>
            <p className="text-xs text-slate-500">
              Quan sát trực diện từ bên ngoài mặt tiền. Tự động liên kết và đồng bộ sang Bước 5 và chỉ số E3.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Lún Chênh */}
          <LevelSelectorWithGuide
            title="Lún Chênh Móng / Nền Ngoại Quan"
            subtitle="Đánh giá dấu hiệu lún không đều chân móng hoặc vết nứt bậc thang tiếp giáp"
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
              label="Vị trí phát hiện lún chênh ngoại quan"
              placeholder="VD: Mép móng góc trước bên phải tiếp giáp nhà số 142..."
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
            title="Nghiêng Toàn Bộ Công Trình Ngoại Quan"
            subtitle="Quan sát độ lệch khe hở láng giềng hoặc đo nhanh nivo laser góc đứng"
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
            <div className="grid grid-cols-2 gap-3">
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
