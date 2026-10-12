import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { SyncStatusBadge } from '../../survey-phase1/components/SyncStatusBadge';
import { ArrowLeft, Home, Check, Cloud, UserX, Undo2, Lock } from 'lucide-react';
import clsx from 'clsx';
import { auditCondoUnitPhotos } from '../utils/condoUnitPhotoAudit';
import { CondoUnitPhotoAuditModal } from './CondoUnitPhotoAuditModal';
import { validateCondoUnitSingleStep } from '../utils/condoUnitValidator';

export const CONDO_UNIT_STEPS = [
  '1. Đối soát toà mẹ & 2 ảnh',
  '2. Thông tin căn hộ',
  '3. Import CAD & Khuyết tật',
  '4. Tóm tắt & Nộp hồ sơ',
];

export const CONDO_UNIT_ABSENTEE_STEPS = [
  '1. Đối soát toà mẹ & 2 ảnh',
  '2. Định danh & Ghi nhận vắng nhà',
  '3. Biên bản & Nộp hồ sơ vắng',
];

interface Props {
  onBackToHub: () => void;
}

export const CondoUnitWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const {
    currentStep,
    setStep,
    formData,
    syncStatus,
    lastSavedAt,
    syncDraftToServer,
    releaseDraftLock,
    isPhotoAuditOpen,
    setIsPhotoAuditOpen,
    setAbsenteeMode,
    isReadOnly,
  } = useCondoUnitSurveyStore();

  const audit = React.useMemo(() => auditCondoUnitPhotos(formData), [formData]);

  const activeUnitLabel = formData.displayCode || formData.unitCode || '---';

  // Map store sync status to SyncStatusBadge props
  const badgeSyncStatus = syncStatus === 'SAVING' ? 'SYNCING' : syncStatus;

  // Xác định trạng thái hoàn thành của từng bước: đạt chuẩn khi KHÔNG còn lỗi chặn cứng (Blocking Issues)
  const isStepDone = (stepNum: number) => {
    const issues = validateCondoUnitSingleStep(stepNum, formData);
    return issues.filter((i) => i.isBlocking).length === 0;
  };

  // Kiểm tra điều kiện chuyển bước tuần tự: không cho nhảy cóc sang bước tương lai nếu bước trước còn lỗi chặn cứng
  const checkCanNavigate = (targetStep: number): { allowed: boolean; blockedStep?: number; reason?: string } => {
    if (isReadOnly || targetStep <= currentStep) {
      return { allowed: true };
    }
    const stepLabels = formData.isAbsentee ? CONDO_UNIT_ABSENTEE_STEPS : CONDO_UNIT_STEPS;
    for (let s = 1; s < targetStep; s++) {
      const stepIssues = validateCondoUnitSingleStep(s, formData);
      const blocking = stepIssues.filter((i) => i.isBlocking);
      if (blocking.length > 0) {
        const stepLabel = stepLabels[s - 1] || `Bước ${s}`;
        const firstIssue = blocking[0];
        return {
          allowed: false,
          blockedStep: s,
          reason: `Bước "${stepLabel}" còn ${blocking.length} mục bắt buộc chưa hoàn thành: ${firstIssue.title}`,
        };
      }
    }
    return { allowed: true };
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep === currentStep) return;
    const check = checkCanNavigate(targetStep);
    if (!check.allowed) {
      alert(`🚫 Chưa thể chuyển sang Bước ${targetStep}:\n\n${check.reason}\n\nVui lòng hoàn thiện các mục bắt buộc của bước trước.`);
      return;
    }
    setStep(targetStep);
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
      {/* Top action header */}
      <div className="px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-3 max-w-7xl mx-auto">
        {/* Left Info & Back */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-[55%] sm:max-w-none">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0"
            title="Quay lại danh sách căn hộ"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Quay lại Hub</span>
            <span className="sm:hidden text-xs">Về Hub</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 shrink-0">
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded font-mono truncate">
                  CĂN {activeUnitLabel}
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap">
                  Tầng {formData.floorNumber ?? 1}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block truncate max-w-[200px] sm:max-w-[320px]">
                {formData.parentInfo?.buildingName || 'Tòa Chung Cư'}
              </span>
            </div>
          </div>
        </div>

        {/* Auto save badge & Cloud R2 photo sync badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud R2 Photo Sync Badge */}
          {audit.total > 0 && (
            <button
              type="button"
              onClick={() => setIsPhotoAuditOpen(true)}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                audit.unsynced === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Bấm để kiểm toán chi tiết từng ảnh & tải lại lên Cloud R2"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {audit.unsynced === 0
                  ? `Cloud R2 (${audit.synced}/${audit.total} ảnh)`
                  : `${audit.unsynced}/${audit.total} ảnh chưa lên Cloud`}
              </span>
              <span className="sm:hidden">
                {audit.unsynced === 0 ? `${audit.total} ảnh` : `${audit.unsynced} chờ sync`}
              </span>
            </button>
          )}

          {/* Toggle Chế Độ Vắng Mặt / Khóa Cửa */}
          {!isReadOnly && (
            formData.isAbsentee ? (
              <button
                type="button"
                onClick={() => {
                  const confirmSwitch = window.confirm(
                    'Chuyển lại kịch bản Khảo Sát Bình Thường?\n(Chỉ chuyển khi chủ nhà đã có mặt mở cửa cho vào bên trong)'
                  );
                  if (confirmSwitch) setAbsenteeMode(false);
                }}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                title="Chuyển lại khảo sát đầy đủ khi chủ nhà có mặt"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chủ Nhà Đã Về</span>
                <span className="sm:hidden">Có Mặt</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const confirmSwitch = window.confirm(
                    'Chuyển sang kịch bản Khảo Sát Vắng Mặt / Khóa Cửa?\n(Bỏ qua khảo sát nội thất Z-E-D và chữ ký chủ nhà)'
                  );
                  if (confirmSwitch) setAbsenteeMode(true);
                }}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                title="Chuyển sang lập hồ sơ khi chủ nhà vắng mặt"
              >
                <UserX className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Báo Vắng Mặt</span>
                <span className="sm:hidden">Vắng</span>
              </button>
            )
          )}

          {isReadOnly ? (
            <span
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300"
              title="Biểu mẫu ở chế độ chỉ xem: không sửa, không đồng bộ"
            >
              Chỉ xem · Không đồng bộ
            </span>
          ) : (
            <SyncStatusBadge
              syncStatus={badgeSyncStatus}
              lastSyncedAt={lastSavedAt}
              isDirty={false}
              onManualSync={() => {
                void syncDraftToServer();
              }}
              onReleaseLock={() => {
                void releaseDraftLock();
              }}
            />
          )}
        </div>
      </div>

      {/* Step Tabs (Thích ứng 3 bước khi vắng mặt, 4 bước khi bình thường) */}
      <div className="px-2 sm:px-4 pb-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar" role="tablist">
        <div className="flex items-center gap-1.5 min-w-[560px] sm:min-w-0">
          {(formData.isAbsentee ? CONDO_UNIT_ABSENTEE_STEPS : CONDO_UNIT_STEPS).map((label, idx) => {
            const stepNum = idx + 1;
            const isPassed = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const completed = isStepDone(stepNum);
            const navCheck = checkCanNavigate(stepNum);
            const isLocked = !navCheck.allowed && stepNum > currentStep;

            return (
              <button
                key={stepNum}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                id={`condo-unit-tab-step-${stepNum}`}
                onClick={() => handleStepClick(stepNum)}
                className={clsx(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 truncate border cursor-pointer select-none',
                  isCurrent
                    ? formData.isAbsentee
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs font-bold ring-2 ring-purple-500/30'
                      : 'bg-teal-700 text-white border-teal-700 shadow-xs font-bold ring-2 ring-teal-500/30'
                    : isLocked
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/60'
                    : isPassed || completed
                    ? formData.isAbsentee
                      ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100/80 hover:border-purple-400'
                      : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100/80 hover:border-teal-400'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                )}
                title={
                  isLocked
                    ? `Bị khóa: ${navCheck.reason}`
                    : `Chuyển tới ${label}`
                }
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 font-bold transition-all',
                    isCurrent
                      ? 'bg-white text-teal-700'
                      : isLocked
                      ? 'bg-slate-300 text-slate-500'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : isPassed
                      ? 'bg-teal-200 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {isLocked ? (
                    <Lock className="w-2.5 h-2.5" />
                  ) : completed && !isCurrent ? (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ) : (
                    stepNum
                  )}
                </span>
                <span className="truncate">{label.includes('. ') ? label.split('. ')[1] : label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>

    {/* Modal Kiểm Toán Chi Tiết Toàn Bộ Ảnh Khảo Sát */}
    <CondoUnitPhotoAuditModal
      isOpen={isPhotoAuditOpen}
      onClose={() => setIsPhotoAuditOpen(false)}
      onNavigateToStep={(s) => setStep(s)}
    />
  </>
);
};
