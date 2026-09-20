import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { LevelSelectorWithGuide } from './LevelSelectorWithGuide';
import {
  SETTLEMENT_LEVEL_OPTIONS,
  TILT_LEVEL_OPTIONS,
  SAG_LEVEL_OPTIONS,
} from '../constants/levelGuideConstants';
import { Ruler, Activity, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

export const Step5_SettlementTiltSurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const st = formData.settlementTilt;

  const lSettlement = st.diffSettlement?.level ?? 0;
  const lTilt = st.buildingTilt?.level ?? 0;
  const lSag = st.beamSagging?.level ?? 0;
  const calculatedE3 = Math.min(4, Math.max(lSettlement, lTilt, lSag));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & E3 Preview Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                5. Khảo Sát Lún – Nghiêng – Võng Dầm Sàn (Mục 6 Docx & Tính Điểm E3)
              </h2>
              <p className="text-xs text-slate-500">
                Đánh giá theo 4 mức chuẩn kỹ thuật. Điểm chỉ số <strong>E3 = Max(Lún, Nghiêng, Võng)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chỉ số E3 = {calculatedE3}/4đ</span>
            </span>
          </div>
        </div>

        {/* 3 Main Level Selectors */}
        <div className="space-y-5 mt-4">
          {/* 1. Lún Chênh */}
          <LevelSelectorWithGuide
            title="1. Lún Chênh Móng / Nền Công Trình"
            subtitle="Dấu hiệu chuyển vị lún không đều chân móng hoặc vết nứt bậc thang tường bao"
            selectedLevel={st.diffSettlement?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...st,
                  diffSettlement: { ...st.diffSettlement, level },
                },
              })
            }
            options={SETTLEMENT_LEVEL_OPTIONS}
          >
            <Input
              label="Vị trí phát hiện lún chênh"
              placeholder="VD: Mép móng góc sau nhà tiếp giáp rãnh thoát nước..."
              value={st.diffSettlement?.position || ''}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    diffSettlement: { ...st.diffSettlement, position: e.target.value },
                  },
                })
              }
            />
          </LevelSelectorWithGuide>

          {/* 2. Nghiêng Toàn Bộ Công Trình */}
          <LevelSelectorWithGuide
            title="2. Nghiêng Toàn Bộ Công Trình"
            subtitle="Độ lệch phương thẳng đứng của toàn khối nhà. Đơn vị đo chuẩn: ‰ (phần nghìn)"
            selectedLevel={st.buildingTilt?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...st,
                  buildingTilt: { ...st.buildingTilt, level },
                },
              })
            }
            options={TILT_LEVEL_OPTIONS}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Phương X (‰)"
                type="number"
                step="0.1"
                placeholder="VD: 3.5"
                value={st.buildingTilt?.xPermille ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      buildingTilt: {
                        ...st.buildingTilt,
                        xPermille: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
                hint="Trục ngang mặt tiền"
              />
              <Input
                label="Phương Y (‰)"
                type="number"
                step="0.1"
                placeholder="VD: 2.1"
                value={st.buildingTilt?.yPermille ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      buildingTilt: {
                        ...st.buildingTilt,
                        yPermille: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
                hint="Trục dọc chiều sâu"
              />
              <Input
                label="Hướng nghiêng chính"
                placeholder="VD: Nghiêng về bên trái 45°"
                value={st.buildingTilt?.direction || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      buildingTilt: { ...st.buildingTilt, direction: e.target.value },
                    },
                  })
                }
              />
            </div>
          </LevelSelectorWithGuide>

          {/* 3. Võng Dầm / Bản Sàn */}
          <LevelSelectorWithGuide
            title="3. Võng Dầm / Bản Sàn BTCT"
            subtitle="Hiện tượng uốn võng phần tử chịu uốn ngang (dầm, sê-nô, ban công, ô sàn)"
            selectedLevel={st.beamSagging?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...st,
                  beamSagging: { ...st.beamSagging, level },
                },
              })
            }
            options={SAG_LEVEL_OPTIONS}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Vị trí dầm/sàn bị võng"
                placeholder="VD: Dầm D2 trục 2-3 Tầng 2, Bản sàn ban công trước..."
                value={st.beamSagging?.position || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      beamSagging: { ...st.beamSagging, position: e.target.value },
                    },
                  })
                }
              />
              <Input
                label="Độ võng đo được (mm)"
                type="number"
                step="0.5"
                placeholder="VD: 15"
                value={st.beamSagging?.sagMm ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      beamSagging: {
                        ...st.beamSagging,
                        sagMm: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
                hint="Đo từ đáy dầm tới dây căng"
              />
            </div>
          </LevelSelectorWithGuide>
        </div>

        {/* Nguồn thu thập & Độ tin cậy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
          <Select
            label="Độ Tin Cậy Dữ Liệu Lún Nghiêng"
            value={st.reliability}
            onChange={(e) =>
              updateFormData({
                settlementTilt: { ...st, reliability: e.target.value as any },
              })
            }
            options={[
              { value: 'HIGH', label: 'Cao (Có máy toàn đạc / Thước nivo laser chuẩn)' },
              { value: 'MEDIUM', label: 'Trung bình (Đo nhanh bằng thước dây & bọt nước)' },
              { value: 'LOW', label: 'Thấp (Chỉ quan sát trực quan bằng mắt thường)' },
            ]}
          />

          <div className="flex items-center mt-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={st.needAdditionalMonitoring?.required}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      needAdditionalMonitoring: {
                        ...st.needAdditionalMonitoring,
                        required: e.target.checked,
                      },
                    },
                  })
                }
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Yêu cầu đo đạc / Quan trắc chuyển vị bổ sung khi thi công Metro</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 4
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 6 (Phạm vi & Ranh GIS) ➔
        </Button>
      </div>
    </div>
  );
};
