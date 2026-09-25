import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Button } from '../../../../core/components/ui/Button';
import { Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { Camera, Maximize2, ArrowRight } from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';
import { P03_TAGS } from './step1.constants';

interface Step1PhotosSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  onOpenPolygonModal: () => void;
}

export const Step1PhotosSection: React.FC<Step1PhotosSectionProps> = ({
  formData,
  updateFormData,
  onOpenPolygonModal,
}) => {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.5. Chụp 4 Bộ Ảnh Định Danh Bên Ngoài
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
              recommendedOrientation="landscape"
              orientationHint="Khuyến nghị: Chụp ảnh NGANG (4:3) để lấy trọn vẹn biển số"
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
                recommendedOrientation="portrait"
                orientationHint="Khuyến nghị: Chụp ảnh DỌC (3:4 / 9:16) để bao quát toàn bộ chiều cao công trình từ vỉa hè lên mái"
                watermarkText={`P-02 | FACADE | ${formData.projectParcelCode}`}
                height="160px"
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
                        ✓ Đã chấm {formData.photoP02.polygonPoints?.length} điểm đa giác & {formData.photoP02.floorSplits?.length || 0} line phân tầng
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        ⚠️ Bắt buộc chấm đa giác mặt tiền (tối thiểu 3 điểm) & line phân tầng *
                      </span>
                    )}
                  </div>
                  <Button
                    id="btn-p02-polygon"
                    size="sm"
                    variant={(formData.photoP02.polygonPoints?.length || 0) >= 3 ? 'outline' : 'primary'}
                    icon={<Maximize2 className="w-3.5 h-3.5" />}
                    onClick={onOpenPolygonModal}
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
                recommendedOrientation="portrait"
                orientationHint="Khuyến nghị: Chụp ảnh DỌC (3:4) để lấy chiều cao khối hông"
                watermarkText={`P-03 | ${formData.photoP03.tag || 'MAT-BEN'}`}
                height="125px"
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
            <div className="space-y-2">
              <PhotoCaptureInput
                label="Chụp bối cảnh tiếp cận tuyến đường/ngõ:"
                value={formData.photoP04.url}
                onChange={(url) =>
                  updateFormData({ photoP04: { ...formData.photoP04, url } })
                }
                recommendedOrientation="landscape"
                orientationHint="Khuyến nghị: Chụp ảnh NGANG (16:9 / 4:3) góc rộng bao quát cả dãy phố và đường trước nhà"
                annotationTitle="Đánh dấu mũi tên chỉ rõ vị trí ngôi nhà khảo sát trên ảnh P-04"
                initialAnnotationTool="ARROW"
                watermarkText={`P-04 | CONTEXT | ${formData.street || 'STREET'}`}
                height="150px"
              />
              {formData.photoP04.url && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Nhấn nút <strong>"Vẽ / Chú thích"</strong> ở góc ảnh trên để kéo mũi tên ➔ chỉ rõ ngôi nhà của chúng ta trong toàn cảnh dãy phố.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
