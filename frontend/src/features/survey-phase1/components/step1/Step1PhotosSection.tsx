import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Button } from '../../../../core/components/ui/Button';
import { Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { Camera, Maximize2, ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { Phase1SurveyFormData } from '../../types/phase1.types';
import { P03_TAGS } from './step1.constants';
import { usePhase1SurveyStore } from '../../store/usePhase1SurveyStore';

interface Step1PhotosSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  onOpenPolygonModal: () => void;
  isCondoMaster?: boolean;
  readOnly?: boolean;
}

export const Step1PhotosSection: React.FC<Step1PhotosSectionProps> = ({
  formData,
  updateFormData,
  onOpenPolygonModal,
  isCondoMaster,
  readOnly: propReadOnly,
}) => {
  const storeReadOnly = usePhase1SurveyStore((s) => s.isReadOnly);
  const isReadOnly = propReadOnly ?? storeReadOnly;
  const areaType = isCondoMaster ? 'GENERAL_TOWER' : 'PRIVATE_HOUSE';
  const category = 'exterior';
  const buildingCode = isCondoMaster ? formData.projectParcelCode : undefined;
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
              photoCode={formData.photoP01.photoCode}
              onChange={(url, code) =>
                updateFormData({ photoP01: { ...formData.photoP01, url, photoCode: code } })
              }
              recommendedOrientation="landscape"
              orientationHint="Khuyến nghị: Chụp ảnh NGANG (4:3) để lấy trọn vẹn biển số"
              watermarkOptions={{
                parcelCode: formData.projectParcelCode,
                buildingCode,
                areaType,
                category,
                floor: 'EXT',
                photoType: 'P01',
                photoIndex: 1,
              }}
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
                photoCode={formData.photoP02.photoCode}
                onChange={(url, code) =>
                  updateFormData({
                    photoP02: { ...formData.photoP02, url, photoCode: code },
                  })
                }
                recommendedOrientation="portrait"
                orientationHint="Khuyến nghị: Chụp ảnh DỌC (3:4 / 9:16) để bao quát toàn bộ chiều cao công trình từ vỉa hè lên mái"
                watermarkOptions={{
                  parcelCode: formData.projectParcelCode,
                  buildingCode,
                  areaType,
                  category,
                  floor: 'EXT',
                  photoType: 'P02',
                  photoIndex: 1,
                }}
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
                    {isReadOnly
                      ? 'Xem đa giác & phân tầng'
                      : (formData.photoP02.polygonPoints?.length || 0) >= 3
                        ? 'Chỉnh sửa đa giác & phân tầng'
                        : 'Chấm điểm đa giác & phân tầng *'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* P-03: Mặt Bên / Mặt Sau */}
        <div id="photo-p03-section" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800">
              P-03: Mặt Bên Hoặc Mặt Sau Tiếp Cận (Tối đa 3 ảnh)
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
            <div className="space-y-3">
              {/* Ảnh P03 chính (Ảnh 1) */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Ảnh 1 (Chính):
                  </span>
                  <div className="w-48">
                    <Select
                      value={formData.photoP03.tag || P03_TAGS[0]}
                      onChange={(e) =>
                        updateFormData({
                          photoP03: { ...formData.photoP03, tag: e.target.value },
                        })
                      }
                      options={P03_TAGS.map((t) => ({ value: t, label: t }))}
                    />
                  </div>
                </div>
                <PhotoCaptureInput
                  label={`Chụp ảnh mặt bên/sau (${formData.photoP03.tag || 'Bên hông trái'}):`}
                  value={formData.photoP03.url}
                  photoCode={formData.photoP03.photoCode}
                  onChange={(url, code) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, url, photoCode: code },
                    })
                  }
                  recommendedOrientation="portrait"
                  orientationHint="Khuyến nghị: Chụp ảnh DỌC (3:4) để lấy chiều cao khối hông"
                  watermarkOptions={{
                    parcelCode: formData.projectParcelCode,
                    buildingCode,
                    areaType,
                    category,
                    floor: 'EXT',
                    photoType: 'P03',
                    zoneOrRoom: formData.photoP03.tag || 'MAT-BEN',
                    photoIndex: 1,
                  }}
                  height="125px"
                />
              </div>

              {/* Các ảnh P03 bổ sung (Ảnh 2, Ảnh 3) */}
              {(formData.photoP03.additionalPhotos || []).map((extraPhoto, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded-lg border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-800">
                      Ảnh {idx + 2} (Bổ sung):
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-44">
                        <Select
                          value={extraPhoto.tag || P03_TAGS[Math.min(idx + 1, P03_TAGS.length - 1)]}
                          onChange={(e) => {
                            const next = [...(formData.photoP03.additionalPhotos || [])];
                            next[idx] = { ...next[idx], tag: e.target.value };
                            updateFormData({
                              photoP03: { ...formData.photoP03, additionalPhotos: next },
                            });
                          }}
                          options={P03_TAGS.map((t) => ({ value: t, label: t }))}
                        />
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = (formData.photoP03.additionalPhotos || []).filter((_, i) => i !== idx);
                            updateFormData({
                              photoP03: { ...formData.photoP03, additionalPhotos: next },
                            });
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          title="Xóa ảnh này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <PhotoCaptureInput
                    label={`Chụp ảnh mặt bên/sau (${extraPhoto.tag || 'Bổ sung'}):`}
                    value={extraPhoto.url}
                    photoCode={extraPhoto.photoCode}
                    onChange={(url, code) => {
                      const next = [...(formData.photoP03.additionalPhotos || [])];
                      next[idx] = { ...next[idx], url, photoCode: code };
                      updateFormData({
                        photoP03: { ...formData.photoP03, additionalPhotos: next },
                      });
                    }}
                    recommendedOrientation="portrait"
                    orientationHint="Khuyến nghị: Chụp ảnh DỌC (3:4) để lấy chiều cao khối hông"
                    watermarkOptions={{
                      parcelCode: formData.projectParcelCode,
                      buildingCode,
                      areaType,
                      category,
                      floor: 'EXT',
                      photoType: 'P03',
                      zoneOrRoom: extraPhoto.tag || 'MAT-BEN',
                      photoIndex: idx + 2,
                    }}
                    height="125px"
                  />
                </div>
              ))}

              {/* Nút thêm ảnh P-03 phụ nếu chưa đạt giới hạn 3 ảnh */}
              {!isReadOnly && (formData.photoP03.additionalPhotos || []).length < 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentExtras = formData.photoP03.additionalPhotos || [];
                    const usedTags = [formData.photoP03.tag || P03_TAGS[0], ...currentExtras.map((p) => p.tag)];
                    const nextTag = P03_TAGS.find((t) => !usedTags.includes(t)) || 'Khác';
                    updateFormData({
                      photoP03: {
                        ...formData.photoP03,
                        additionalPhotos: [...currentExtras, { url: '', tag: nextTag, photoCode: '' }],
                      },
                    });
                  }}
                  className="w-full py-2 px-3 border border-dashed border-sky-400 bg-sky-50/60 hover:bg-sky-50 text-sky-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-600" />
                  <span>Thêm mặt bên / mặt sau khác (Còn lại: {2 - (formData.photoP03.additionalPhotos || []).length} ảnh)</span>
                </button>
              )}
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
                photoCode={formData.photoP04.photoCode}
                onChange={(url, code) =>
                  updateFormData({ photoP04: { ...formData.photoP04, url, photoCode: code } })
                }
                recommendedOrientation="landscape"
                orientationHint="Khuyến nghị: Chụp ảnh NGANG (16:9 / 4:3) góc rộng bao quát cả dãy phố và đường trước nhà"
                annotationTitle="Đánh dấu mũi tên chỉ rõ vị trí ngôi nhà khảo sát trên ảnh P-04"
                initialAnnotationTool="ARROW"
                watermarkOptions={{
                  parcelCode: formData.projectParcelCode,
                  buildingCode,
                  areaType,
                  category,
                  floor: 'EXT',
                  photoType: 'P04',
                  photoIndex: 1,
                }}
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
