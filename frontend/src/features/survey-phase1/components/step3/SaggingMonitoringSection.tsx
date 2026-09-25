import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Input, Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide } from '../LevelSelectorWithGuide';
import { SAG_LEVEL_OPTIONS } from '../../constants/levelGuideConstants';
import { Ruler, Sparkles } from 'lucide-react';

interface SaggingMonitoringSectionProps {
  settlementTilt: any;
  projectParcelCode: string;
  onUpdateSettlementTilt: (updater: any) => void;
}

export const SaggingMonitoringSection: React.FC<SaggingMonitoringSectionProps> = ({
  settlementTilt,
  projectParcelCode,
  onUpdateSettlementTilt,
}) => {
  const beamSagging = settlementTilt?.beamSagging || {};
  const needMonitoring = settlementTilt?.needAdditionalMonitoring || {};

  const e3Index = Math.min(
    4,
    Math.max(
      settlementTilt?.diffSettlement?.level ?? 0,
      settlementTilt?.buildingTilt?.level ?? 0,
      beamSagging.level ?? 0
    )
  );

  return (
    <Card className="border-violet-200 bg-white space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-violet-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              3.3. Võng Dầm Sàn & Đề Xuất Quan Trắc Chuyên Sâu
            </h3>
            <p className="text-xs text-slate-500">
              Khảo sát độ võng dầm/sàn bên trong nhà và chốt yêu cầu lắp mốc quan trắc lún nghiêng
            </p>
          </div>
        </div>
        <span className="text-xs font-black px-3 py-1.5 rounded-xl border bg-violet-50 border-violet-200 text-violet-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span>Chỉ số E3 = {e3Index}/4</span>
        </span>
      </div>

      <div className="space-y-5">
        <LevelSelectorWithGuide
          title="Võng Dầm / Bản Sàn Kết Cấu Bên Trong"
          subtitle="Hiện tượng uốn võng phần tử chịu uốn ngang (dầm chính, dầm phụ, bản sàn, ô văng)"
          selectedLevel={beamSagging.level ?? 0}
          onChangeLevel={(level) =>
            onUpdateSettlementTilt({
              beamSagging: { ...beamSagging, level },
            })
          }
          options={SAG_LEVEL_OPTIONS}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Vị trí cấu kiện bị võng"
              placeholder="VD: Dầm D2 trục 2-3 Tầng 2, Bản sàn ban công..."
              value={beamSagging.position || ''}
              onChange={(e) =>
                onUpdateSettlementTilt({
                  beamSagging: { ...beamSagging, position: e.target.value },
                })
              }
            />
            <Input
              label="Độ võng ước tính (mm)"
              type="number"
              step="0.5"
              placeholder="VD: 15"
              value={beamSagging.sagMm ?? ''}
              onChange={(e) =>
                onUpdateSettlementTilt({
                  beamSagging: {
                    ...beamSagging,
                    sagMm: e.target.value ? Number(e.target.value) : '',
                  },
                })
              }
              hint="Đo từ đáy dầm tới dây căng"
            />
            <Input
              label="Mô tả hiện tượng võng"
              placeholder="VD: Nứt chữ V giữa nhịp, rung nhẹ khi di chuyển..."
              value={beamSagging.description || ''}
              onChange={(e) =>
                onUpdateSettlementTilt({
                  beamSagging: { ...beamSagging, description: e.target.value },
                })
              }
            />
          </div>

          {/* Bổ sung ảnh chụp & ghi chú cho 3.3 */}
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhotoCaptureInput
              label="Ảnh chụp dầm/sàn bị võng hoặc vị trí mốc quan trắc:"
              value={beamSagging.photoUrl || ''}
              onChange={(url) =>
                onUpdateSettlementTilt({
                  beamSagging: {
                    ...beamSagging,
                    photoUrl: url,
                  },
                })
              }
              recommendedOrientation="landscape"
              orientationHint="Khuyến nghị: Chụp ảnh NGANG (16:9 / 4:3) lấy trọn nhịp dầm/sàn"
              watermarkText={`3.3 | VONG-DAM-SAN | ${projectParcelCode}`}
              height="130px"
            />
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ghi chú hiện trạng võng / giải pháp quan trắc:
              </label>
              <textarea
                rows={4}
                placeholder="Mô tả cụ thể vị trí võng lớn nhất, hiện trạng dây căng hoặc mốc quan trắc đo lường..."
                value={beamSagging.notes || ''}
                onChange={(e) =>
                  onUpdateSettlementTilt({
                    beamSagging: {
                      ...beamSagging,
                      notes: e.target.value,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        </LevelSelectorWithGuide>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <Select
            label="Cần Đo / Quan Trắc Bổ Sung Chuyên Sâu:"
            value={needMonitoring.required ? 'YES' : 'NO'}
            onChange={(e) =>
              onUpdateSettlementTilt({
                needAdditionalMonitoring: {
                  ...needMonitoring,
                  required: e.target.value === 'YES',
                },
              })
            }
            options={[
              { value: 'NO', label: 'Không - Hiện trạng bình thường' },
              { value: 'YES', label: 'Có - Cần lắp mốc theo dõi / đo đạc chuyên sâu' },
            ]}
          />
          {needMonitoring.required && (
            <div className="pt-2 animate-in fade-in">
              <Input
                label="Nhận xét / Đề xuất giải pháp quan trắc cụ thể:"
                placeholder="VD: Cần lắp mốc quan trắc lún nghiêng tự động chu kỳ 2 tuần/lần..."
                value={needMonitoring.notes || ''}
                onChange={(e) =>
                  onUpdateSettlementTilt({
                    needAdditionalMonitoring: {
                      ...needMonitoring,
                      notes: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
