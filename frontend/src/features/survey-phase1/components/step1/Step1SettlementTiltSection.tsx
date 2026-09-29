import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Input } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide } from '../LevelSelectorWithGuide';
import { Building, Plus, Trash2 } from 'lucide-react';
import { Phase1SurveyFormData, EvidencePhotoItem } from '../../types/phase1.types';
import { SETTLEMENT_LEVEL_OPTIONS, TILT_LEVEL_OPTIONS, DATA_SOURCES } from './step1.constants';

interface MultiEvidencePhotoInputProps {
  primaryLabel: string;
  photos: EvidencePhotoItem[];
  onChange: (photos: EvidencePhotoItem[]) => void;
  photoType: string;
  parcelCode: string;
  recommendedOrientation?: 'portrait' | 'landscape';
  orientationHint?: string;
  addLabel: string;
}

const MultiEvidencePhotoInput: React.FC<MultiEvidencePhotoInputProps> = ({
  primaryLabel,
  photos,
  onChange,
  photoType,
  parcelCode,
  recommendedOrientation = 'landscape',
  orientationHint,
  addLabel,
}) => {
  const list = photos.length > 0 ? photos : [{ url: '', photoCode: '', notes: '' }];

  const handleUpdate = (index: number, url: string, code?: string) => {
    const next = [...list];
    next[index] = { ...next[index], url, photoCode: code };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = list.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ url: '', photoCode: '', notes: '' }]);
  };

  const handleAdd = () => {
    onChange([...list, { url: '', photoCode: '', notes: '' }]);
  };

  return (
    <div className="space-y-2.5">
      {list.map((item, idx) => (
        <div key={idx} className="p-2 bg-slate-50/80 rounded-lg border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">
              {idx === 0 ? primaryLabel : `${primaryLabel} (Ảnh ${idx + 1}):`}
            </span>
            {idx > 0 && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                title="Xóa ảnh này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <PhotoCaptureInput
            value={item.url}
            photoCode={item.photoCode}
            onChange={(url, code) => handleUpdate(idx, url, code)}
            recommendedOrientation={recommendedOrientation}
            orientationHint={orientationHint}
            watermarkOptions={{
              parcelCode,
              floor: photoType === 'SETTLE' ? 'FOUND' : 'EXT',
              photoType,
              photoIndex: idx + 1,
            }}
            height="120px"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full py-2 px-3 border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
      >
        <Plus className="w-3.5 h-3.5 text-emerald-600" />
        <span>{addLabel}</span>
      </button>
    </div>
  );
};

interface Step1SettlementTiltSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
}

export const Step1SettlementTiltSection: React.FC<Step1SettlementTiltSectionProps> = ({
  formData,
  updateFormData,
}) => {
  return (
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
          alwaysShowChildren={true}
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
          <div className="space-y-3">
            {(formData.settlementTilt?.diffSettlement?.level ?? 0) > 0 && (
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
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MultiEvidencePhotoInput
                primaryLabel={(formData.settlementTilt?.diffSettlement?.level ?? 0) > 0 ? "Ảnh chụp vị trí lún chênh / chân tường:" : "Ảnh chụp hiện trạng chân tường / nền nhà (Minh chứng không lún):"}
                photos={formData.settlementTilt?.diffSettlement?.photos || (formData.settlementTilt?.diffSettlement?.photoUrl ? [{ url: formData.settlementTilt.diffSettlement.photoUrl, photoCode: formData.settlementTilt.diffSettlement.photoCode }] : [])}
                onChange={(photos) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      diffSettlement: {
                        ...formData.settlementTilt.diffSettlement,
                        photos,
                        photoUrl: photos[0]?.url || '',
                        photoCode: photos[0]?.photoCode || '',
                      },
                    },
                  })
                }
                photoType="SETTLE"
                parcelCode={formData.projectParcelCode}
                recommendedOrientation="landscape"
                addLabel="Chụp thêm ảnh lún / chân tường"
              />
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {(formData.settlementTilt?.diffSettlement?.level ?? 0) > 0 ? "Ghi chú chi tiết hiện tượng lún:" : "Ghi chú minh chứng (không có lún chênh):"}
                </label>
                <textarea
                  rows={4}
                  placeholder={(formData.settlementTilt?.diffSettlement?.level ?? 0) > 0 ? "Mô tả mức độ tách vách, nứt chân tường, vết nứt bậc thang do lún..." : "Ghi chú hiện trạng chân tường, nền nhà bằng phẳng, không có dấu hiệu lún..."}
                  value={formData.settlementTilt?.diffSettlement?.notes || ''}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...formData.settlementTilt,
                        diffSettlement: {
                          ...formData.settlementTilt.diffSettlement,
                          notes: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </LevelSelectorWithGuide>

        {/* Nghiêng Công Trình */}
        <LevelSelectorWithGuide
          title="2. Độ Nghiêng Công Trình (Mặt tiền / Khối nhà)"
          selectedLevel={formData.settlementTilt?.buildingTilt?.level ?? 0}
          alwaysShowChildren={true}
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
          <div className="space-y-3">
            {(formData.settlementTilt?.buildingTilt?.level ?? 0) > 0 && (
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
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MultiEvidencePhotoInput
                primaryLabel={(formData.settlementTilt?.buildingTilt?.level ?? 0) > 0 ? "Ảnh chụp độ nghiêng khối nhà / thước đo Laser/Nivo:" : "Ảnh chụp mặt đứng công trình (Minh chứng không nghiêng):"}
                photos={formData.settlementTilt?.buildingTilt?.photos || (formData.settlementTilt?.buildingTilt?.photoUrl ? [{ url: formData.settlementTilt.buildingTilt.photoUrl, photoCode: formData.settlementTilt.buildingTilt.photoCode }] : [])}
                onChange={(photos) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      buildingTilt: {
                        ...formData.settlementTilt.buildingTilt,
                        photos,
                        photoUrl: photos[0]?.url || '',
                        photoCode: photos[0]?.photoCode || '',
                      },
                    },
                  })
                }
                photoType="TILT"
                parcelCode={formData.projectParcelCode}
                recommendedOrientation="portrait"
                addLabel="Chụp thêm ảnh mặt đứng / độ nghiêng"
              />
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Ghi chú chi tiết độ nghiêng:
                </label>
                <textarea
                  rows={4}
                  placeholder="Mô tả hướng nghiêng (về bên trái/phải/sau), khoảng hở đỉnh tường với nhà liền kề..."
                  value={formData.settlementTilt?.buildingTilt?.notes || ''}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...formData.settlementTilt,
                        buildingTilt: {
                          ...formData.settlementTilt.buildingTilt,
                          notes: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </LevelSelectorWithGuide>

        {/* 3. Trường Hợp Ngoại Lệ / Hiện Trạng Bất Thường Khác */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <span className="text-xs font-bold text-slate-800 block">
            3. Trường Hợp Ngoại Lệ / Hiện Trạng Bất Thường Khác (Nếu có)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MultiEvidencePhotoInput
              primaryLabel="Ảnh chụp trường hợp bất thường / ngoại lệ:"
              photos={formData.settlementTilt?.abnormalCase?.photos || (formData.settlementTilt?.abnormalCase?.photoUrl ? [{ url: formData.settlementTilt.abnormalCase.photoUrl, photoCode: formData.settlementTilt.abnormalCase.photoCode }] : [])}
              onChange={(photos) =>
                updateFormData({
                  settlementTilt: {
                    ...formData.settlementTilt,
                    abnormalCase: {
                      ...formData.settlementTilt?.abnormalCase,
                      photos,
                      photoUrl: photos[0]?.url || '',
                      photoCode: photos[0]?.photoCode || '',
                    },
                  },
                })
              }
              photoType="ANOMALY"
              parcelCode={formData.projectParcelCode}
              recommendedOrientation="landscape"
              addLabel="Chụp thêm ảnh hiện trạng bất thường"
            />
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ghi chú trường hợp ngoại lệ:
              </label>
              <textarea
                rows={4}
                placeholder="VD: Rễ cây lớn làm nứt vỉa hè, hố ga thoát nước sát móng bị sụt, vết nứt tường rào không liên kết khối nhà chính..."
                value={formData.settlementTilt?.abnormalCase?.notes || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      abnormalCase: {
                        ...formData.settlementTilt?.abnormalCase,
                        notes: e.target.value,
                      },
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

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
  );
};
