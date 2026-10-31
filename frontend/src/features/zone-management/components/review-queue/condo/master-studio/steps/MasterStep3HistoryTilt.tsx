import React from 'react';
import {
  Activity,
  History,
  AlertTriangle,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

export const MasterStep3HistoryTilt: React.FC<
  CondoAuditStepProps<CondoMasterFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
}) => {
  const h = formState.historyInterview || {};
  const st = formState.settlementTilt || {};
  const diffSet = st.diffSettlement || {};
  const bTilt = st.buildingTilt || {};

  const updateSettlementField = (
    section: 'diffSettlement' | 'buildingTilt' | 'needAdditionalMonitoring',
    field: string,
    val: unknown,
    label: string
  ) => {
    const nextSt = {
      ...st,
      [section]: {
        ...(st[section] || {}),
        [field]: val,
      },
    };
    handleFieldChange('settlementTilt', label, nextSt);
  };

  return (
    <div className="space-y-6">
      {/* 1. Phỏng vấn Lịch sử Vận hành với Ban Quản Lý (BQL) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          <History className="w-4 h-4 text-indigo-600" />
          <span>Phỏng vấn Lịch sử Vận hành &amp; Biến động Khối tháp (Ban Quản Lý)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                1. Lịch sử cải tạo / Thay đổi tải trọng khối đế
              </span>
              {isEditMode ? (
                <select
                  value={Number(h.renovationLoad ?? 0)}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'historyInterview',
                      'renovationLoad',
                      'Điểm lịch sử cải tạo khối tháp',
                      Number(e.target.value)
                    )
                  }
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value={0}>0 — Chưa từng cải tạo kết cấu</option>
                  <option value={1}>1 — Cải tạo nội thất nhẹ</option>
                  <option value={2}>2 — Cải tạo công năng tầng thương mại</option>
                  <option value={3}>3 — Gia tăng tải trọng đáng kể</option>
                </select>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-100 text-indigo-800">
                  Mức {h.renovationLoad ?? 0}
                </span>
              )}
            </div>
            {isEditMode ? (
              <input
                type="text"
                value={String(h.renovationNotes || '')}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'historyInterview',
                    'renovationNotes',
                    'Chi tiết cải tạo khối tháp',
                    e.target.value
                  )
                }
                placeholder="Ghi chú chi tiết..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {h.renovationNotes || 'Không ghi nhận cải tạo kết cấu.'}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                2. Tiền sử lún nền / Nứt tường tầng hầm trong quá khứ
              </span>
              {isEditMode ? (
                <select
                  value={Number(h.pastSettlement ?? 0)}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'historyInterview',
                      'pastSettlement',
                      'Điểm tiền sử lún khối tháp',
                      Number(e.target.value)
                    )
                  }
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value={0}>0 — Ổn định, không có tiền sử lún</option>
                  <option value={1}>1 — Lún nhẹ đường nội bộ / ram dốc</option>
                  <option value={2}>2 — Từng xử lý thấm / nứt vách hầm</option>
                  <option value={3}>3 — Có tiền sử lún lệch cần theo dõi</option>
                </select>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-100 text-indigo-800">
                  Mức {h.pastSettlement ?? 0}
                </span>
              )}
            </div>
            {isEditMode ? (
              <input
                type="text"
                value={String(h.settlementNotes || '')}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'historyInterview',
                    'settlementNotes',
                    'Ghi chú tiền sử lún khối tháp',
                    e.target.value
                  )
                }
                placeholder="Ghi chú tiền sử lún/thấm vách tầng hầm..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {h.settlementNotes || 'Không có tiền sử lún lệch bất thường.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Đánh giá Lún lệch (Differential Settlement) & Độ nghiêng Khối tháp (Building Tilt) */}
      <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-slate-800/50 border border-amber-200 dark:border-slate-750 space-y-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
          <Activity className="w-4 h-4 text-amber-600" />
          <span>Quan Trắc Độ Nghiêng Tổng Thể &amp; Lún Lệch Khối Đế (E3 Deformation)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lún lệch */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                Cấp độ Lún lệch quan sát (0 → 4)
              </span>
              {isEditMode ? (
                <select
                  value={Number(diffSet.level ?? 0)}
                  onChange={(e) =>
                    updateSettlementField(
                      'diffSettlement',
                      'level',
                      Number(e.target.value),
                      'Cấp độ lún lệch khối tháp'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value={0}>Cấp 0 — Không phát hiện lún lệch</option>
                  <option value={1}>Cấp 1 — Lún nhẹ nền vỉa hè / tam cấp (&lt; 5mm)</option>
                  <option value={2}>Cấp 2 — Lún cục bộ khe co giãn / ram dốc</option>
                  <option value={3}>Cấp 3 — Lún lệch rõ rệt gây nứt xiên</option>
                  <option value={4}>Cấp 4 — Lún nghiêm trọng ảnh hưởng kết cấu</option>
                </select>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-100 text-amber-900">
                  Cấp {diffSet.level ?? 0}
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Vị trí &amp; Ghi chú lún lệch
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={String(diffSet.notes || diffSet.position || '')}
                  onChange={(e) =>
                    updateSettlementField(
                      'diffSettlement',
                      'notes',
                      e.target.value,
                      'Ghi chú lún lệch khối tháp'
                    )
                  }
                  placeholder="Vị trí khe lún / ram dốc tầng hầm..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              ) : (
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {diffSet.notes || diffSet.position || 'Không phát hiện dấu hiệu lún lệch.'}
                </div>
              )}
            </div>
          </div>

          {/* Độ nghiêng khối tháp */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                Độ nghiêng Khối tháp (‰ - Phần nghìn)
              </span>
              {isEditMode ? (
                <select
                  value={Number(bTilt.level ?? 0)}
                  onChange={(e) =>
                    updateSettlementField(
                      'buildingTilt',
                      'level',
                      Number(e.target.value),
                      'Cấp độ nghiêng khối tháp'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value={0}>Cấp 0 — Thẳng đứng trong giới hạn cho phép</option>
                  <option value={1}>Cấp 1 — Nghiêng nhẹ (&lt; 2‰)</option>
                  <option value={2}>Cấp 2 — Nghiêng trung bình (2‰ – 4‰)</option>
                  <option value={3}>Cấp 3 — Nghiêng vượt ngưỡng cảnh báo (&gt; 4‰)</option>
                </select>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-100 text-amber-900">
                  Cấp {bTilt.level ?? 0}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">Phương X (‰)</span>
                {isEditMode ? (
                  <input
                    type="number"
                    step="0.1"
                    value={bTilt.xPermille ?? 0}
                    onChange={(e) =>
                      updateSettlementField(
                        'buildingTilt',
                        'xPermille',
                        e.target.value,
                        'Độ nghiêng phương X (‰)'
                      )
                    }
                    className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                  />
                ) : (
                  <strong className="font-mono text-xs">{bTilt.xPermille ?? 0} ‰</strong>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 block">Phương Y (‰)</span>
                {isEditMode ? (
                  <input
                    type="number"
                    step="0.1"
                    value={bTilt.yPermille ?? 0}
                    onChange={(e) =>
                      updateSettlementField(
                        'buildingTilt',
                        'yPermille',
                        e.target.value,
                        'Độ nghiêng phương Y (‰)'
                      )
                    }
                    className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                  />
                ) : (
                  <strong className="font-mono text-xs">{bTilt.yPermille ?? 0} ‰</strong>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 block">Hướng nghiêng</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={String(bTilt.direction || '')}
                    onChange={(e) =>
                      updateSettlementField(
                        'buildingTilt',
                        'direction',
                        e.target.value,
                        'Hướng nghiêng khối tháp'
                      )
                    }
                    placeholder="VD: Đông Nam"
                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                  />
                ) : (
                  <strong className="text-xs">{bTilt.direction || 'Không'}</strong>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Khuyến nghị quan trắc bổ sung */}
        <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 dark:text-amber-200 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isEditMode}
              checked={Boolean(st.needAdditionalMonitoring?.required)}
              onChange={(e) =>
                updateSettlementField(
                  'needAdditionalMonitoring',
                  'required',
                  e.target.checked,
                  'Yêu cầu gắn mốc quan trắc lún nghiêng chuyên sâu'
                )
              }
            />
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              Đề xuất gắn mốc quan trắc lún &amp; nghiêng tự động (Inclinometer / Tiltmeter) trước khi TBM đào qua
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

