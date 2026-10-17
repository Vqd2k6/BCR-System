import React from 'react';
import {
  Home,
  User,
  Layers,
  Award,
  Activity,
  MapPin,
  Hash,
  FileCheck2,
  PenTool,
  Edit3,
  Undo2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../../../core/components/ui/Button';
import { useAuditStepwiseForm } from './hooks/useAuditStepwiseForm';
import { usePhotoOrientationAudit, type PhotoOrientationViolation } from './hooks/usePhotoOrientationAudit';
import { PhotoOrientationAlertBanner } from './components/PhotoOrientationAlertBanner';
import { AuditStep1Identification } from './steps/AuditStep1Identification';
import { AuditStep2OwnerInterview } from './steps/AuditStep2OwnerInterview';
import { AuditStep3FloorDefects } from './steps/AuditStep3FloorDefects';
import { AuditStep4BurlandSummary } from './steps/AuditStep4BurlandSummary';
import { AuditStep5SettlementTilt } from './steps/AuditStep5SettlementTilt';
import { AuditStep6ScopeGisMutation } from './steps/AuditStep6ScopeGisMutation';
import { AuditStep7EcsViScores } from './steps/AuditStep7EcsViScores';
import { AuditStep8Conclusions } from './steps/AuditStep8Conclusions';
import { AuditStep9SignaturesAbsence } from './steps/AuditStep9SignaturesAbsence';
import type { DiffItem, AuditStepwiseData, PhotoReplaceParams, AuditPhotoActionParams, AuditPhotoHistoryParams, PhotoActionPayload } from './types';

export interface AuditStepwiseDocumentViewProps {
  data: AuditStepwiseData | Record<string, unknown>;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, unknown>) => void;
  onOpenEngineeringJudgement: () => void;
  onDirtyChange?: (info: {
    dirtyCount: number;
    diffItems: DiffItem[];
    updates: Record<string, unknown>;
    discardAll: (silent?: boolean) => void;
  }) => void;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  onOrientationAuditChange?: (status: {
    hasMismatched: boolean;
    hasStrictViolations: boolean;
    mismatchedCount: number;
    violations: PhotoOrientationViolation[];
    stagedPhotoRotations: Record<string, number>;
  }) => void;
}

export const AuditStepwiseDocumentView: React.FC<AuditStepwiseDocumentViewProps> = ({
  data,
  reportId,
  onRefresh,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  onOpenDiffModal,
  onOpenEngineeringJudgement,
  onDirtyChange,
  stagedPhotoActions = [],
  onUndoPhotoAction,
  onOrientationAuditChange,
}) => {
  const {
    isEditMode,
    setIsEditMode,
    activeNavStep,
    scrollToStep,
    formState,
    dirtyFields,
    dirtyCount,
    isFieldDirty,
    handleFieldChange,
    handleNestedFieldChange,
    handleDiscard,
    handleReviewSave,
    getDiffPayload,
  } = useAuditStepwiseForm({ data, onOpenDiffModal });

  // Kiểm toán hướng ảnh Nhà Dân Thường theo khuyến nghị chuẩn FE
  const {
    violations,
    hasMismatchedPhotos,
    hasStrictViolations,
    mismatchedCount,
    stagedPhotoRotations,
    setPhotoRotation,
    getPhotoRotation,
  } = usePhotoOrientationAudit(data as Record<string, unknown>);

  // Đồng bộ trạng thái kiểm toán hướng ảnh lên modal cấp cha
  React.useEffect(() => {
    if (onOrientationAuditChange) {
      onOrientationAuditChange({
        hasMismatched: hasMismatchedPhotos,
        hasStrictViolations,
        mismatchedCount,
        violations,
        stagedPhotoRotations,
      });
    }
  }, [hasMismatchedPhotos, hasStrictViolations, mismatchedCount, violations, stagedPhotoRotations, onOrientationAuditChange]);

  const handleNavigateToPhoto = (v: PhotoOrientationViolation) => {
    scrollToStep(v.stepId);
    setTimeout(() => {
      const el = document.getElementById(v.domElementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-500', 'ring-offset-2', 'animate-pulse');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-500', 'ring-offset-2', 'animate-pulse');
        }, 3500);
      }
    }, 350);
  };

  const handleQuickRotate = (photoKey: string, currentRot: number) => {
    setPhotoRotation(photoKey, (currentRot + 90) % 360);
  };

  // Đồng bộ dirty state lên AuditStudioModal cấp cha
  React.useEffect(() => {
    if (onDirtyChange) {
      const { diffItems, updatesPayload } = getDiffPayload();
      onDirtyChange({
        dirtyCount,
        diffItems,
        updates: updatesPayload,
        discardAll: (silent = false) => handleDiscard(silent),
      });
    }
  }, [dirtyCount, dirtyFields, onDirtyChange]);

  const stepsList = [
    { id: 'step-1', number: '01', title: 'Nhận Diện & Hiện Trạng Tổng Quan', icon: Home },
    { id: 'step-2', number: '02', title: 'Đo Biến Dạng & Lún Nghiêng', icon: Activity },
    { id: 'step-3', number: '03', title: 'Kết Cấu & Phỏng Vấn', icon: User },
    { id: 'step-4', number: '04', title: 'Tầng, Vùng Z & Cấu Kiện E', icon: Layers },
    { id: 'step-5', number: '05', title: 'Khuyết Tật Bề Mặt & Nứt Burland', icon: Award },
    { id: 'step-6', number: '06', title: 'Tương Quan Metro & Đột Biến GIS', icon: MapPin },
    { id: 'step-7', number: '07', title: 'Bảng Điểm Kỹ Thuật ECS & VI', icon: Hash },
    { id: 'step-8', number: '08', title: 'Kết Luận & Đề Xuất Thẩm Định', icon: FileCheck2 },
    { id: 'step-9', number: '09', title: 'Biên Bản Hiện Trường Đã Ký', icon: PenTool },
  ];

  return (
    <div className="relative flex flex-col lg:flex-row gap-6 w-full min-h-[600px]">
      {/* 1. Thanh điều hướng Jump-links bên trái (Sticky Sidebar) */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="sticky top-4 bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <div>
              <span className="text-[10px] font-black uppercase text-sky-700 tracking-wider">
                Mục Lục Thẩm Định
              </span>
              <h4 className="text-sm font-black text-slate-800">9 Bước Khảo Sát</h4>
            </div>
            {/* Nút bật/tắt chế độ sửa hoặc badge đã khóa duyệt */}
            {data?.status === 'APPROVED' ? (
              <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã Khóa Duyệt</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                  isEditMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditMode ? 'Đang Sửa' : 'Chế Độ Sửa'}</span>
              </button>
            )}
          </div>

          {/* Danh sách 9 bước */}
          <nav className="space-y-1">
            {stepsList.map((st) => {
              const Icon = st.icon;
              const isActive = activeNavStep === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => scrollToStep(st.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer ${
                    isActive
                      ? 'bg-sky-50 text-sky-900 font-bold border border-sky-300 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="truncate">{st.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-sky-200/80 text-sky-900 font-bold' : 'text-slate-400 group-hover:bg-slate-200/60'}`}>
                    {st.number}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Thanh công cụ Lưu / Hủy khi có thay đổi - GIỮ BẢO LƯU KHI TẮT CHẾ ĐỘ SỬA */}
          {dirtyCount > 0 && (
            <div className="pt-3 border-t border-amber-200/80 bg-amber-500/10 -mx-4 -mb-4 p-3.5 rounded-b-2xl space-y-2 border-b border-x border-amber-200/80">
              <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>
                    {isEditMode ? 'Đang hiệu chỉnh' : 'Chế độ xem'}: {dirtyCount + (stagedPhotoActions?.length || 0)} sửa đổi
                    {stagedPhotoActions && stagedPhotoActions.length > 0 ? ` (${stagedPhotoActions.length} ảnh)` : ''}
                  </span>
                </div>
                {!isEditMode && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">Chưa lưu</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDiscard(false)}
                  className="flex-1 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
                <button
                  type="button"
                  onClick={handleReviewSave}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Diff ({dirtyCount + (stagedPhotoActions?.length || 0)})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Nội dung chi tiết 9 bước khảo sát theo đúng thứ tự chuẩn hóa */}
      <div className="flex-1 space-y-6">
        {/* Banner cảnh báo sai lệch hướng ảnh theo chuẩn FE Nhà Dân */}
        <PhotoOrientationAlertBanner
          violations={violations}
          onNavigateToPhoto={handleNavigateToPhoto}
          onQuickRotate={handleQuickRotate}
        />

        {/* Bước 01: Nhận Diện & Hiện Trạng Tổng Quan */}
        <AuditStep1Identification
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={setPhotoRotation}
        />

        {/* Bước 02: Đo Đạc Biến Dạng, Lún Nghiêng & Quan Trắc */}
        <AuditStep5SettlementTilt
          isEditMode={isEditMode}
          formState={formState}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={setPhotoRotation}
        />

        {/* Bước 03: Kết Cấu Công Trình, Nền Móng & Phỏng Vấn Chủ Hộ */}
        <AuditStep2OwnerInterview
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
        />

        {/* Bước 04: Hiện Trạng Tầng, Vùng Z & Cấu Kiện Kết Cấu E */}
        <AuditStep3FloorDefects
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={setPhotoRotation}
        />

        {/* Bước 05: Khuyết Tật Bề Mặt & Tổng Hợp Nứt Burland 1977 */}
        <AuditStep4BurlandSummary
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
        />

        {/* Bước 06: Tương Quan Vị Trí Metro & Đột Biến GIS */}
        <AuditStep6ScopeGisMutation
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          reportId={reportId}
          handleNestedFieldChange={handleNestedFieldChange}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onRefresh={onRefresh}
          isFieldDirty={isFieldDirty}
        />

        {/* Bước 07: Bảng Điểm Kỹ Thuật ECS & VI */}
        <AuditStep7EcsViScores
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          reportId={reportId}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onRefresh={onRefresh}
          onOpenEngineeringJudgement={onOpenEngineeringJudgement}
          isFieldDirty={isFieldDirty}
        />

        {/* Bước 08: Kết Luận & Đề Xuất Thẩm Định */}
        <AuditStep8Conclusions
          isEditMode={isEditMode}
          formState={formState}
          handleNestedFieldChange={handleNestedFieldChange}
          handleFieldChange={handleFieldChange}
          isFieldDirty={isFieldDirty}
        />

        {/* Bước 09: Biên Bản Hiện Trường Đã Ký (Hình Chụp Biên Bản) */}
        <AuditStep9SignaturesAbsence
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          onConfirmAbsenteeSurvey={onRefresh}
          isFieldDirty={isFieldDirty}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={setPhotoRotation}
        />
      </div>
    </div>
  );
};
