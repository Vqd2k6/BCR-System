import React from 'react';
import { Activity, Ruler, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SETTLEMENT_LEVEL_OPTIONS } from '../../../../../survey-phase1/components/step1/step1.constants';
import { SAG_LEVEL_OPTIONS } from '../../../../../survey-phase1/constants/levelGuideConstants';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
}

export const AuditStep5SettlementTilt: React.FC<Props> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
}) => {
  const st = formState.settlementTilt || {};
  const tilt = st.buildingTilt || {};
  const beam = st.beamSagging || {};
  const diff = st.diffSettlement || {};
  const monitoring = st.needAdditionalMonitoring || { required: false, notes: '' };

  const lDiff = Number(diff.level) || 0;
  const lTilt = Number(tilt.level) || 0;
  const lSag = Number(beam.level) || 0;
  const calculatedE3 = Math.min(4, Math.max(lDiff, lTilt, lSag));

  return (
    <section id="step-5" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 05
          </span>
          <h3 className="text-sm sm:text-base font-black text-slate-800">
            Đo Đạc Biến Dạng, Lún Nghiêng & Đề Xuất Quan Trắc Mốc Lún
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Chỉ số E3 = {calculatedE3}/4</span>
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Khối 3 thông số biến dạng chính */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Lún chênh lệch */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 block uppercase">
              1. Lún Chênh Lệch Nền Móng (Diff Settlement):
            </span>
            {isEditMode ? (
              <select
                value={diff.level ?? 0}
                onChange={(e) =>
                  handleNestedFieldChange('settlementTilt', 'diffSettlement', 'Cấp độ lún lệch', {
                    ...diff,
                    level: Number(e.target.value),
                  })
                }
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                {SETTLEMENT_LEVEL_OPTIONS.map((opt: any) => (
                  <option key={opt.level} value={opt.level}>
                    Cấp {opt.level} - {opt.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-bold text-slate-800">
                {diff.level !== undefined
                  ? `Cấp ${diff.level} (${SETTLEMENT_LEVEL_OPTIONS.find((o: any) => o.level === diff.level)?.title || 'Bình thường'})`
                  : 'Không phát hiện lún lệch'}
              </div>
            )}
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Vị trí & ghi chú lún lệch:</span>
              {isEditMode ? (
                <input
                  type="text"
                  value={diff.position || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'diffSettlement', 'Vị trí lún lệch', {
                      ...diff,
                      position: e.target.value,
                    })
                  }
                  className="w-full p-1 bg-white border border-slate-300 rounded text-xs mt-0.5"
                  placeholder="Vị trí ghi nhận lún..."
                />
              ) : (
                <div className="text-[11px] text-slate-600 italic">
                  {diff.position || 'Không có ghi nhận vị trí lún lệch cụ thể.'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Độ nghiêng công trình */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 block uppercase">
              2. Độ Nghiêng Công Trình (Building Tilt):
            </span>
            {isEditMode ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs font-mono font-bold text-slate-600">X:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={tilt.xPermille ?? 0}
                      onChange={(e) =>
                        handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Độ nghiêng X', {
                          ...tilt,
                          xPermille: Number(e.target.value),
                        })
                      }
                      className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-bold font-mono bg-white"
                      placeholder="‰"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs font-mono font-bold text-slate-600">Y:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={tilt.yPermille ?? 0}
                      onChange={(e) =>
                        handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Độ nghiêng Y', {
                          ...tilt,
                          yPermille: Number(e.target.value),
                        })
                      }
                      className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-bold font-mono bg-white"
                      placeholder="‰"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={tilt.direction || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'buildingTilt', 'Hướng nghiêng', {
                      ...tilt,
                      direction: e.target.value,
                    })
                  }
                  className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                  placeholder="Hướng nghiêng (VD: Nghiêng về hẻm sau...)"
                />
              </div>
            ) : (
              <div>
                <div className="text-xs font-black text-slate-800 font-mono">
                  X: {tilt.xPermille || '0'} ‰ &bull; Y: {tilt.yPermille || '0'} ‰
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Hướng: <strong>{tilt.direction || 'Không ghi nhận hướng nghiêng'}</strong>
                </div>
              </div>
            )}
            <div className="text-[11px] text-slate-500 italic">
              {tilt.notes || 'Không có ghi chú độ nghiêng.'}
            </div>
          </div>

          {/* 3. Độ võng dầm / bản sàn */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 block uppercase">
              3. Độ Võng Dầm / Bản Sàn (Beam Sagging):
            </span>
            {isEditMode ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <select
                    value={beam.level ?? 0}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'beamSagging', 'Cấp độ võng dầm', {
                        ...beam,
                        level: Number(e.target.value),
                      })
                    }
                    className="flex-1 p-1 bg-white border border-slate-300 rounded text-xs font-bold"
                  >
                    {SAG_LEVEL_OPTIONS.map((opt: any) => (
                      <option key={opt.level} value={opt.level}>
                        Cấp {opt.level} - {opt.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={beam.sagMm ?? ''}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'beamSagging', 'Độ võng mm', {
                        ...beam,
                        sagMm: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-18 p-1 bg-white border border-slate-300 rounded text-xs font-bold"
                    placeholder="Võng (mm)"
                  />
                </div>
                <input
                  type="text"
                  value={beam.position || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'beamSagging', 'Vị trí dầm võng', {
                      ...beam,
                      position: e.target.value,
                    })
                  }
                  className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                  placeholder="Vị trí dầm (VD: Dầm D2 trục 2-3 Tầng 2)"
                />
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {beam.sagMm ? `Võng ${beam.sagMm} mm (Cấp ${beam.level || 0})` : 'Không phát hiện võng'}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Vị trí: <strong>{beam.position || 'Không xác định'}</strong>
                </div>
                {beam.description && (
                  <div className="text-[11px] text-slate-500 italic mt-0.5">{beam.description}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Khối đề xuất quan trắc mốc lún nghiêng chuyên sâu */}
        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Đề Xuất Lắp Đặt Mốc Quan Trắc Lún Nghiêng Chuyên Sâu
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                monitoring.required
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {monitoring.required ? '⚠️ CẦN QUAN TRẮC BỔ SUNG' : '✓ KHÔNG YÊU CẦU QUAN TRẮC'}
            </span>
          </div>

          <div className="text-xs">
            {isEditMode ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(monitoring.required)}
                    onChange={(e) =>
                      handleNestedFieldChange('settlementTilt', 'needAdditionalMonitoring', 'Yêu cầu quan trắc', {
                        ...monitoring,
                        required: e.target.checked,
                      })
                    }
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Yêu cầu bố trí mốc quan trắc biến dạng định kỳ trong quá trình thi công</span>
                </label>
                <input
                  type="text"
                  value={monitoring.notes || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('settlementTilt', 'needAdditionalMonitoring', 'Ghi chú quan trắc', {
                      ...monitoring,
                      notes: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  placeholder="Ghi chú chi tiết phương án và vị trí bố trí mốc quan trắc..."
                />
              </div>
            ) : (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 italic">
                {monitoring.notes || (monitoring.required ? 'Yêu cầu quan trắc lún nghiêng định kỳ.' : 'Công trình ổn định, không yêu cầu đặt mốc quan trắc.')}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

