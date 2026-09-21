import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { LevelSelectorWithGuide } from './LevelSelectorWithGuide';
import { SAG_LEVEL_OPTIONS } from '../constants/levelGuideConstants';
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
                5. Khảo Sát Võng Dầm Sàn & Đề Xuất Quan Trắc Chuyên Sâu
              </h2>
              <p className="text-xs text-slate-500">
                Khảo sát độ võng dầm/sàn bên trong nhà và chốt yêu cầu lắp mốc quan trắc lún nghiêng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chỉ số E3 = {calculatedE3}/4</span>
            </span>
          </div>
        </div>

        {/* Võng Dầm / Bản Sàn */}
        <div className="space-y-5 mt-4">
          <LevelSelectorWithGuide
            title="Võng Dầm / Bản Sàn Kết Cấu Bên Trong"
            subtitle="Hiện tượng uốn võng phần tử chịu uốn ngang (dầm chính, dầm phụ, bản sàn, ô văng)"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Vị trí cấu kiện bị võng"
                placeholder="VD: Dầm D2 trục 2-3 Tầng 2, Bản sàn ban công..."
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
                label="Độ võng ước tính (mm)"
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
              <Input
                label="Mô tả hiện tượng võng"
                placeholder="VD: Nứt chữ V giữa nhịp, rung nhẹ khi di chuyển..."
                value={st.beamSagging?.description || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      beamSagging: { ...st.beamSagging, description: e.target.value },
                    },
                  })
                }
              />
            </div>
          </LevelSelectorWithGuide>
        </div>

        {/* Cần đo / Quan trắc bổ sung chuyên sâu */}
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <Select
              label="Cần Đo / Quan Trắc Bổ Sung Chuyên Sâu:"
              value={st.needAdditionalMonitoring?.required ? 'YES' : 'NO'}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    needAdditionalMonitoring: {
                      ...st.needAdditionalMonitoring,
                      required: e.target.value === 'YES',
                    },
                  },
                })
              }
              options={[
                { value: 'NO', label: 'Không - Hiện trạng bình thường' },
                { value: 'YES', label: 'Có - Cần lắp mốc theo dõi / đo đạc chuyên sâu' },
              ]}
            />

            {st.needAdditionalMonitoring?.required && (
              <div className="pt-2 animate-in fade-in">
                <Input
                  label="Nhận xét / Đề xuất giải pháp quan trắc cụ thể:"
                  placeholder="VD: Cần lắp mốc quan trắc lún nghiêng tự động chu kỳ 2 tuần/lần trong suốt quá trình đào ngầm Metro..."
                  value={st.needAdditionalMonitoring?.notes || ''}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        needAdditionalMonitoring: {
                          ...st.needAdditionalMonitoring,
                          notes: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            )}
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
