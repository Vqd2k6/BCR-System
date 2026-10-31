import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  FileSignature,
  Maximize2,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

export const MasterStep5ScoresSignoff: React.FC<
  CondoAuditStepProps<CondoMasterFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
  onOpenEngineeringJudgement,
}) => {
  const ecs = formState.ecs || {};
  const vi = formState.vi || {};
  const exec = formState.executiveSummary || {};
  const sigs = formState.signatures || {};

  return (
    <div className="space-y-6">
      {/* 1. Bảng Điểm Tổng Hợp ECS / VI / Impact / BRA của Khối Tháp Mẹ */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-800 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-200">
              Ma Trận Chỉ Số Rủi Ro Cơ Sở Khối Tháp (Master ECS • VI • Impact • BRA)
            </h3>
          </div>

          {onOpenEngineeringJudgement && (
            <button
              type="button"
              onClick={onOpenEngineeringJudgement}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Can Thiệp Phán Quyết Kỹ Sư Trưởng</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/10 border border-white/15">
            <div className="text-[10px] text-indigo-200 uppercase font-bold">
              Tổng Điểm Hiện Trạng (ECS)
            </div>
            <div className="text-lg font-mono font-black text-white mt-0.5">
              {ecs.totalEcs ?? 0} điểm ({ecs.ecsClass || 'GOOD'})
            </div>
            <div className="text-[10px] text-slate-300 font-mono mt-1">
              E1:{ecs.e1 ?? 0} E2:{ecs.e2 ?? 0} E3:{ecs.e3 ?? 0} E4:{ecs.e4 ?? 0} E5:{ecs.e5 ?? 0} E6:{ecs.e6 ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/10 border border-white/15">
            <div className="text-[10px] text-indigo-200 uppercase font-bold">
              Chỉ Số Tổn Thương (VI)
            </div>
            <div className="text-lg font-mono font-black text-amber-300 mt-0.5">
              {vi.avgVi ?? 0} ({vi.viClass || 'MEDIUM'})
            </div>
            <div className="text-[10px] text-slate-300 font-mono mt-1">
              V1:{vi.v1 ?? 3} V2:{vi.v2 ?? 2} V3:{vi.v3 ?? 3} V4:{vi.v4 ?? 3} V5:{vi.v5 ?? 2} V6:{vi.v6 ?? 1}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/10 border border-white/15">
            <div className="text-[10px] text-indigo-200 uppercase font-bold">
              Mức Độ Tác Động (Impact)
            </div>
            {isEditMode ? (
              <select
                value={String(exec.constructionImpactStatus || 'I2')}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'executiveSummary',
                    'constructionImpactStatus',
                    'Mức độ tác động thi công (I1-I4)',
                    e.target.value
                  )
                }
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-indigo-400 text-white text-xs font-bold"
              >
                <option value="I1">I1 — Không đáng kể</option>
                <option value="I2">I2 — Ảnh hưởng nhẹ</option>
                <option value="I3">I3 — Ảnh hưởng trung bình</option>
                <option value="I4">I4 — Ảnh hưởng nghiêm trọng</option>
              </select>
            ) : (
              <div className="text-lg font-mono font-black text-sky-300 mt-0.5">
                {exec.constructionImpactStatus || 'I2'}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white/10 border border-white/15">
            <div className="text-[10px] text-indigo-200 uppercase font-bold">
              Xếp Hạng Rủi Ro Cơ Sở (BRA)
            </div>
            {isEditMode ? (
              <select
                value={String(exec.braStatus || 'MEDIUM')}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'executiveSummary',
                    'braStatus',
                    'Xếp hạng rủi ro cơ sở BRA',
                    e.target.value
                  )
                }
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-indigo-400 text-white text-xs font-bold"
              >
                <option value="LOW">LOW — Rủi ro thấp</option>
                <option value="MEDIUM">MEDIUM — Rủi ro trung bình</option>
                <option value="HIGH">HIGH — Rủi ro cao</option>
                <option value="VERY_HIGH">VERY_HIGH — Rủi ro rất cao</option>
              </select>
            ) : (
              <div className="text-lg font-mono font-black text-rose-400 mt-0.5">
                {exec.braStatus || 'MEDIUM'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Kết luận Tổng hợp & Đề xuất Kỹ thuật Khối tháp */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Kết luận Tổng hợp Hiện trạng Khối tháp Chung cư
          </label>
          {isEditMode ? (
            <textarea
              rows={4}
              value={formState.summaryConclusions}
              onChange={(e) =>
                handleFieldChange(
                  'summaryConclusions',
                  'Kết luận tổng hợp khối tháp',
                  e.target.value
                )
              }
              placeholder="Nhập kết luận tổng hợp hiện trạng kết cấu khối tháp, tầng hầm và hệ thống kỹ thuật..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap min-h-[88px]">
              {formState.summaryConclusions || 'Chưa có kết luận tổng hợp.'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Kiến nghị Kỹ thuật &amp; Quan trắc trong quá trình đào hầm Metro
          </label>
          {isEditMode ? (
            <textarea
              rows={4}
              value={formState.engineeringRecommendations}
              onChange={(e) =>
                handleFieldChange(
                  'engineeringRecommendations',
                  'Kiến nghị kỹ thuật khối tháp',
                  e.target.value
                )
              }
              placeholder="Nhập kiến nghị kỹ thuật và chế độ quan trắc cho tòa tháp..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap min-h-[88px]">
              {formState.engineeringRecommendations || 'Chưa có kiến nghị kỹ thuật.'}
            </div>
          )}
        </div>
      </div>

      {/* 3. Chữ ký Kỹ sư Khảo sát & Đại diện Ban Quản Lý Tòa Nhà */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          <FileSignature className="w-4 h-4 text-indigo-600" />
          <span>Xác Nhận Pháp Lý Của Kỹ Sư Khảo Sát &amp; Đại Diện Ban Quản Lý Tòa Nhà</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Kỹ sư khảo sát hiện trường</div>
              <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                {sigs.surveyorName || 'Kỹ sư hiện trường'}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {sigs.surveyorPhone || ''}
              </div>
            </div>
            {sigs.surveyorSignature && (
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoZoom(sigs.surveyorSignature!, 'Chữ ký Kỹ sư khảo sát')
                }
                className="w-24 h-14 rounded-lg border border-slate-200 bg-white force-light overflow-hidden cursor-pointer relative group"
              >
                <img
                  src={sigs.surveyorSignature}
                  alt="Chữ ký KSV"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Đại diện Ban Quản Lý Tòa Nhà</div>
              <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                {sigs.ownerName || formState.managementContactName || 'Đại diện BQL'}
              </div>
              <div className="text-[11px] text-slate-500">
                {sigs.ownerFeedback || 'Đã xác nhận biên bản làm việc'}
              </div>
            </div>
            {sigs.ownerSignature && (
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoZoom(sigs.ownerSignature!, 'Chữ ký Đại diện Ban Quản Lý')
                }
                className="w-24 h-14 rounded-lg border border-slate-200 bg-white force-light overflow-hidden cursor-pointer relative group"
              >
                <img
                  src={sigs.ownerSignature}
                  alt="Chữ ký BQL"
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

