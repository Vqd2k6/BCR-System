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
  Compass,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../../../core/components/ui/Button';
import { useAuditStepwiseForm } from './hooks/useAuditStepwiseForm';
import { usePhotoOrientationAudit, type PhotoOrientationViolation } from './hooks/usePhotoOrientationAudit';
import { PhotoOrientationAlertBanner } from './components/PhotoOrientationAlertBanner';
import {
  AuditStudioImgProvider,
  useAuditStudioImg,
  type StudioCommittedPhotoInfo,
} from './context/AuditStudioImgContext';
import { AuditStudioImgModal } from './components/AuditStudioImgModal';
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
import type { FloorSurveyData } from '../../../../survey-phase1/types/phase1.types';

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
    discardDiffItem?: (fieldKey: string) => void;
  }) => void;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
  onDiscardAllStagedPhotos?: () => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  onOrientationAuditChange?: (status: {
    hasMismatched: boolean;
    hasStrictViolations: boolean;
    mismatchedCount: number;
    violations: PhotoOrientationViolation[];
    stagedPhotoRotations: Record<string, number>;
    rotatePhoto?: (photoKey: string, rotationDeg: number, photoUrl?: string) => void;
  }) => void;
}

export const AuditStepwiseDocumentView: React.FC<AuditStepwiseDocumentViewProps> = (props) => {
  const sJson = ((props.data as Record<string, unknown>)?.surveyJson ||
    (props.data as Record<string, unknown>)?.survey_data_json ||
    {}) as Record<string, unknown>;
  const initialEnhancedPhotos = (sJson.studioEnhancedPhotos || {}) as Record<
    string,
    StudioCommittedPhotoInfo
  >;
  const initialEnhancedByOriginal = (sJson.studioEnhancedByOriginal || {}) as Record<
    string,
    string
  >;

  return (
    <AuditStudioImgProvider
      reportId={props.reportId}
      initialEnhancedPhotos={initialEnhancedPhotos}
      initialEnhancedByOriginal={initialEnhancedByOriginal}
    >
      <AuditStepwiseDocumentViewInner {...props} />
    </AuditStudioImgProvider>
  );
};

const AuditStepwiseDocumentViewInner: React.FC<AuditStepwiseDocumentViewProps> = ({
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
  onDiscardAllStagedPhotos,
  onOrientationAuditChange,
}) => {
  const {
    isEditMode,
    setIsEditMode,
    activeNavStep,
    activeSubNavId,
    scrollToStep,
    scrollToSubElement,
    formState,
    dirtyFields,
    dirtyCount,
    isFieldDirty,
    handleFieldChange,
    handleNestedFieldChange,
    handleApplySyncedGeometry,
    handleDiscard,
    discardDiffItem,
    handleReviewSave,
    getDiffPayload,
  } = useAuditStepwiseForm({ data, onOpenDiffModal });

  const {
    isHoldingSKey,
    selectedPhotos,
    toggleSelectPhoto,
    resolveEffectiveStudioUrl,
    isStudioModalOpen,
    setIsStudioModalOpen,
  } = useAuditStudioImg();

  // Floating modal state for orientation guidance & collapsible compact sidebar
  const [isOrientationPanelOpen, setIsOrientationPanelOpen] = React.useState(false);
  const [isStep4Expanded, setIsStep4Expanded] = React.useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const sidebarNavRef = React.useRef<HTMLElement | null>(null);

  // Phím tắt E: Bật/tắt chế độ Edit nhanh khi không đang gõ chữ trong ô nhập liệu
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (isStudioModalOpen || isOrientationPanelOpen) return;
      if (data?.status === 'APPROVED') return;

      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setIsEditMode((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudioModalOpen, isOrientationPanelOpen, data?.status, setIsEditMode]);

  // Chặn mở Zoom khi đang giữ phím S -> đưa ảnh vào danh sách Studio Img
  const handlePhotoZoomOrStudioSelect = React.useCallback(
    (url: string, title?: string, photoCode?: string, rotation?: number) => {
      const effectiveUrl = resolveEffectiveStudioUrl(url);
      if (isHoldingSKey) {
        toggleSelectPhoto({
          url: effectiveUrl,
          title: title || photoCode || 'Ảnh hiện trường',
          photoCode,
          rotation,
        });
        return;
      }
      onOpenPhotoZoom(effectiveUrl, title, photoCode, rotation);
    },
    [isHoldingSKey, resolveEffectiveStudioUrl, toggleSelectPhoto, onOpenPhotoZoom]
  );

  // Tự động mở cây Bước 04 và tự cuộn nội bộ thanh sidebar bên trái (không dùng scrollIntoView để tránh hủy cuộn mượt của #audit-studio-scroll-container)
  React.useEffect(() => {
    if (activeNavStep === 'step-4') {
      setIsStep4Expanded(true);
    }
    const navEl = sidebarNavRef.current;
    if (!navEl) return;
    const targetNavId = activeSubNavId || activeNavStep;
    const activeBtn = navEl.querySelector<HTMLElement>(`[data-nav-id="${targetNavId}"]`);
    if (activeBtn) {
      const navRect = navEl.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      if (btnRect.top < navRect.top + 8) {
        navEl.scrollTop += btnRect.top - navRect.top - 12;
      } else if (btnRect.bottom > navRect.bottom - 8) {
        navEl.scrollTop += btnRect.bottom - navRect.bottom + 12;
      }
    }
  }, [activeNavStep, activeSubNavId]);

  // Kiểm toán hướng ảnh Nhà Dân Thường theo quy chuẩn thời gian thực (formState + stagedPhotoActions)
  const {
    violations,
    strictViolations,
    advisoryViolations,
    violationsMap,
    hasMismatchedPhotos,
    hasStrictViolations,
    mismatchedCount,
    stagedPhotoRotations,
    setPhotoRotation,
    getPhotoRotation,
  } = usePhotoOrientationAudit(data as Record<string, unknown>, formState, stagedPhotoActions);

  // Đồng bộ góc xoay vào formState.photoRotations để làm tăng dirtyCount và lưu đầy đủ qua mọi nút Lưu Diff
  const handleRotatePhoto = React.useCallback(
    (photoKey: string, rotationDeg: number, photoUrl?: string) => {
      const norm = ((rotationDeg % 360) + 360) % 360;
      setPhotoRotation(photoKey, norm, photoUrl);
      const prevRots = ((formState.photoRotations as Record<string, number>) || {}) as Record<string, number>;
      const nextRots: Record<string, number> = {
        ...prevRots,
        ...stagedPhotoRotations,
        [photoKey]: norm,
      };
      handleFieldChange('photoRotations', 'Góc xoay hướng ảnh chuẩn hóa báo cáo', nextRots);
    },
    [setPhotoRotation, formState.photoRotations, stagedPhotoRotations, handleFieldChange]
  );

  // Guard against infinite update loop by comparing state signature before calling parent callback
  const prevOrientationSigRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!onOrientationAuditChange) return;
    const sig = `${hasMismatchedPhotos}-${hasStrictViolations}-${mismatchedCount}-${violations.length}-${Object.keys(stagedPhotoRotations).length}`;
    if (prevOrientationSigRef.current === sig) return;
    prevOrientationSigRef.current = sig;

    onOrientationAuditChange({
      hasMismatched: hasMismatchedPhotos,
      hasStrictViolations,
      mismatchedCount,
      violations,
      stagedPhotoRotations,
      rotatePhoto: handleRotatePhoto,
    });
  }, [hasMismatchedPhotos, hasStrictViolations, mismatchedCount, violations, stagedPhotoRotations, handleRotatePhoto, onOrientationAuditChange]);

  const scrollToElement = React.useCallback(
    (domId: string) => {
      scrollToSubElement(domId, 'step-4');
    },
    [scrollToSubElement]
  );

  const handleNavigateToPhoto = (v: PhotoOrientationViolation) => {
    scrollToStep(v.stepId);
    if (v.floorIndex !== undefined) {
      window.dispatchEvent(new CustomEvent('audit-switch-floor-tab', { detail: { floorIndex: v.floorIndex } }));
    }
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
    handleRotatePhoto(photoKey, (currentRot + 90) % 360);
  };

  // Đồng bộ dirty state lên AuditStudioModal cấp cha với signature guard
  const prevDirtySigRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!onDirtyChange) return;
    const { diffItems, updatesPayload } = getDiffPayload();
    const sig = `${dirtyCount}-${dirtyFields.size}-${diffItems.length}`;
    if (prevDirtySigRef.current === sig) return;
    prevDirtySigRef.current = sig;

    onDirtyChange({
      dirtyCount,
      diffItems,
      updates: updatesPayload,
      discardAll: (silent = false) => handleDiscard(silent),
      discardDiffItem: (fieldKey: string) => discardDiffItem(fieldKey),
    });
  }, [dirtyCount, dirtyFields, onDirtyChange, getDiffPayload, handleDiscard, discardDiffItem]);

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

  const rawFloors: FloorSurveyData[] = Array.isArray(formState.floors) ? (formState.floors as FloorSurveyData[]) : [];
  const floorsList = rawFloors.length > 0 ? rawFloors : [{ id: 'floor-default', floorName: 'Tầng trệt' } as FloorSurveyData];

  // Tính toán tập hợp các bước và mục con (Step 04) đang có cảnh báo (hướng ảnh A4 hoặc cảnh báo nghiệp vụ)
  const { stepWarningSet, subNavWarningSet } = React.useMemo(() => {
    const sSet = new Set<string>();
    const subSet = new Set<string>();

    violations.forEach((v) => {
      if (v.stepId) {
        sSet.add(v.stepId);
      }
      if (v.stepId === 'step-4' && typeof v.floorIndex === 'number') {
        const fIdx = v.floorIndex;
        subSet.add(`step-4-floor-${fIdx}`);
        if (v.key.startsWith('cad_') || v.key.endsWith('_cad') || v.key.endsWith('_structural_cad')) {
          if (v.key.includes('struct')) {
            subSet.add(`step-4-floor-${fIdx}-cad-e`);
          } else {
            subSet.add(`step-4-floor-${fIdx}-cad-z`);
          }
        } else if (v.key.startsWith('element_') || v.key.includes('_e')) {
          subSet.add(`step-4-floor-${fIdx}-elements`);
        } else {
          subSet.add(`step-4-floor-${fIdx}-zones`);
        }
      }
    });

    const warningFlags = (data as Record<string, unknown>)?.auditWarningFlags as Record<string, boolean> | undefined;
    if (warningFlags && !Array.isArray(warningFlags)) {
      const sJson = (data?.surveyJson || data?.survey_data_json || {}) as Record<string, unknown>;
      const isAddrStandardized = Boolean(formState.standardizedAddress || sJson.standardizedAddress);
      if ((warningFlags.hasAddressStandardizationNotice && !isAddrStandardized) || warningFlags.missingIdPhotos) {
        sSet.add('step-1');
      }
      if (warningFlags.hasGisDrift || warningFlags.hasBoundaryConflict) {
        sSet.add('step-6');
      }
      if (warningFlags.missingSignatures) {
        sSet.add('step-9');
      }
    }

    return { stepWarningSet: sSet, subNavWarningSet: subSet };
  }, [violations, data, formState.standardizedAddress]);

  const totalPendingChanges = dirtyCount + (stagedPhotoActions?.length || 0);

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 w-full min-h-[600px] min-w-0 max-w-full">
      {/* 1. Thanh điều hướng Jump-links bên trái (Thiết kế gọn gàng, có nút thu nhỏ & chấm tròn vàng cảnh báo) */}
      <div
        className={`w-full shrink-0 transition-all duration-200 ${
          isSidebarCollapsed ? 'lg:w-14' : 'lg:w-56'
        }`}
      >
        <div className="sticky top-2 max-h-[calc(100vh-3.75rem)] flex flex-col bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200/90 shadow-sm p-2.5 gap-2">
          {/* Header Sidebar + Nút Thu Nhỏ / Mở Rộng */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 shrink-0 gap-1">
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black uppercase text-sky-700 tracking-wider block truncate">
                  Mục Lục Thẩm Định
                </span>
                <h4 className="text-xs font-black text-slate-800 truncate">9 Bước Khảo Sát</h4>
              </div>
            )}

            <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'w-full justify-center flex-col' : ''}`}>
              {/* Nút bật/tắt chế độ sửa hoặc badge đã khóa duyệt */}
              {data?.status === 'APPROVED' ? (
                <span
                  title="Đã Khóa Duyệt"
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {!isSidebarCollapsed && <span>Đã Khóa</span>}
                </span>
              ) : (
                <button
                  type="button"
                  title={isEditMode ? 'Đang ở Chế Độ Sửa (Bấm hoặc nhấn phím E để tắt)' : 'Bật Chế Độ Sửa (Phím tắt: E)'}
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
                    isEditMode
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Edit3 className="w-3 h-3 shrink-0" />
                  {!isSidebarCollapsed && (
                    <>
                      <span>{isEditMode ? 'Đang Sửa' : 'Sửa'}</span>
                      <kbd
                        className={`ml-0.5 px-1 py-0.2 rounded text-[9px] font-mono ${
                          isEditMode
                            ? 'bg-amber-600/80 text-white border border-amber-400/60'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        E
                      </kbd>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                title={isSidebarCollapsed ? 'Mở rộng mục lục bên trái' : 'Thu gọn mục lục bên trái'}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer shrink-0"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Nút Studio Img: Xử lý ảnh đã chọn (Nhấn giữ S + Click ảnh ở mọi chế độ View/Edit) */}
          <button
            type="button"
            onClick={() => setIsStudioModalOpen(true)}
            title="Mở Studio Img • Nhấn giữ phím S + Click vào ảnh bất kỳ để chọn/bỏ chọn đưa vào Studio"
            className={`w-full rounded-xl text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer border shrink-0 ${
              isSidebarCollapsed ? 'p-1.5 justify-center relative' : 'px-2.5 py-1.5'
            } ${
              isHoldingSKey
                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400/60 shadow-sm'
                : selectedPhotos.length > 0
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-indigo-50/70 hover:text-indigo-800 hover:border-indigo-200'
            }`}
          >
            {isSidebarCollapsed ? (
              <>
                <Sparkles
                  className={`w-4 h-4 ${
                    isHoldingSKey
                      ? 'text-white animate-spin'
                      : selectedPhotos.length > 0
                        ? 'text-indigo-600'
                        : 'text-slate-500'
                  }`}
                />
                {selectedPhotos.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {selectedPhotos.length}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isHoldingSKey
                        ? 'text-white animate-pulse'
                        : selectedPhotos.length > 0
                          ? 'text-indigo-600'
                          : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">
                    {isHoldingSKey ? 'Đang giữ S • Click ảnh' : 'Studio Img'}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                    isHoldingSKey
                      ? 'bg-white/20 text-white'
                      : selectedPhotos.length > 0
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200/80 text-slate-600 font-mono'
                  }`}
                >
                  {selectedPhotos.length > 0 ? `${selectedPhotos.length} ảnh` : 'S+Click'}
                </span>
              </>
            )}
          </button>

          {/* Nút mở bảng điều khiển Kiểm toán Hướng Ảnh A4 (Floating Drawer/Modal) */}
          {violations.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOrientationPanelOpen(true)}
              title={`Hướng Ảnh A4 (${violations.length} ảnh cần kiểm tra)`}
              className={`w-full rounded-xl text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer border shrink-0 ${
                isSidebarCollapsed ? 'p-1.5 justify-center relative' : 'px-2.5 py-1.5'
              } ${
                hasStrictViolations
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                  : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
              }`}
            >
              {isSidebarCollapsed ? (
                <>
                  <Compass className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {violations.length}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Compass className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                    <span className="truncate">Hướng Ảnh ({violations.length})</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      strictViolations.length > 0 ? 'bg-amber-200 text-amber-900' : 'bg-sky-200 text-sky-900'
                    }`}
                  >
                    {strictViolations.length > 0 ? `${strictViolations.length} Bắt Buộc` : 'Gợi ý'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Danh sách 9 bước (Cuộn độc lập và tự động nhảy theo vị trí cuộn của TDV) */}
          <nav
            ref={sidebarNavRef}
            className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-0.5 scrollbar-thin"
          >
            {stepsList.map((st) => {
              const Icon = st.icon;
              const isActive = activeNavStep === st.id;
              const isStep4 = st.id === 'step-4';
              const hasStepWarning = stepWarningSet.has(st.id);

              return (
                <div key={st.id} className="space-y-0.5">
                  <button
                    type="button"
                    data-nav-id={st.id}
                    title={`${st.number}. ${st.title}${hasStepWarning ? ' (Có cảnh báo cần kiểm tra)' : ''}`}
                    onClick={() => {
                      scrollToStep(st.id);
                      if (isStep4) setIsStep4Expanded(true);
                    }}
                    className={`w-full text-left rounded-xl text-[11px] font-semibold transition-all flex items-center group cursor-pointer relative ${
                      isSidebarCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 justify-between'
                    } ${
                      isActive
                        ? 'bg-sky-50 text-sky-900 font-bold border border-sky-300 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    {isSidebarCollapsed ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-mono leading-none">{st.number}</span>
                        {hasStepWarning && (
                          <span
                            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
                            title="Mục này đang có cảnh báo cần kiểm tra"
                          />
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                          <span className="truncate">{st.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {hasStepWarning && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 shrink-0"
                              title="Mục này đang có cảnh báo hoặc ảnh cần kiểm tra"
                            />
                          )}
                          {isStep4 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsStep4Expanded((prev) => !prev);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsStep4Expanded((prev) => !prev);
                                }
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer rounded"
                            >
                              {isStep4Expanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                              isActive
                                ? 'bg-sky-200/80 text-sky-900 font-bold'
                                : 'text-slate-400 group-hover:bg-slate-200/60'
                            }`}
                          >
                            {st.number}
                          </span>
                        </div>
                      </>
                    )}
                  </button>

                  {/* Cây danh mục con cho Bước 4: Từng tầng với CAD_Z -> Z -> CAD_E -> E */}
                  {isStep4 && isStep4Expanded && !isSidebarCollapsed && (
                    <div className="pl-2.5 pr-0.5 py-1 space-y-1.5 border-l-2 border-sky-200 ml-2.5 my-0.5">
                      {floorsList.map((fl, fIdx) => {
                        const floorDomId = `step-4-floor-${fIdx}`;
                        const cadZDomId = `step-4-floor-${fIdx}-cad-z`;
                        const zonesDomId = `step-4-floor-${fIdx}-zones`;
                        const cadEDomId = `step-4-floor-${fIdx}-cad-e`;
                        const elementsDomId = `step-4-floor-${fIdx}-elements`;
                        const isFloorActive =
                          activeSubNavId === floorDomId ||
                          activeSubNavId.startsWith(`${floorDomId}-`);
                        const hasFloorWarning = subNavWarningSet.has(floorDomId);
                        const hasCadZWarning = subNavWarningSet.has(cadZDomId);
                        const hasZonesWarning = subNavWarningSet.has(zonesDomId);
                        const hasCadEWarning = subNavWarningSet.has(cadEDomId);
                        const hasElementsWarning = subNavWarningSet.has(elementsDomId);

                        return (
                          <div key={fl.id || fIdx} className="space-y-0.5">
                            <button
                              type="button"
                              data-nav-id={floorDomId}
                              onClick={() => scrollToElement(floorDomId)}
                              className={`w-full text-left text-[10px] font-black uppercase tracking-wider flex items-center justify-between gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                isFloorActive
                                  ? 'text-sky-800 bg-sky-100/70'
                                  : 'text-slate-700 hover:text-sky-700'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isFloorActive ? 'bg-sky-600 ring-2 ring-sky-300' : 'bg-sky-500'
                                  }`}
                                />
                                <span className="truncate">{fl.floorName || `Tầng ${fIdx + 1}`}</span>
                              </div>
                              {hasFloorWarning && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 shrink-0"
                                  title="Tầng này có ảnh hoặc mục cần kiểm tra"
                                />
                              )}
                            </button>
                            <div className="space-y-0.5 pl-1.5 border-l border-slate-200">
                              <button
                                type="button"
                                data-nav-id={cadZDomId}
                                onClick={() => scrollToElement(cadZDomId)}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] flex items-center justify-between font-mono cursor-pointer transition-colors ${
                                  activeSubNavId === cadZDomId
                                    ? 'bg-sky-600 text-white font-bold shadow-2xs'
                                    : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
                                }`}
                              >
                                <span className="truncate">CAD_Z Kiến Trúc</span>
                                {hasCadZWarning && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-amber-400/40 shrink-0" />
                                )}
                              </button>
                              <button
                                type="button"
                                data-nav-id={zonesDomId}
                                onClick={() => scrollToElement(zonesDomId)}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] flex items-center justify-between cursor-pointer transition-colors ${
                                  activeSubNavId === zonesDomId
                                    ? 'bg-sky-600 text-white font-bold shadow-2xs'
                                    : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
                                }`}
                              >
                                <span className="truncate">Vùng Z ({(fl.zones || []).length})</span>
                                {hasZonesWarning && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-amber-400/40 shrink-0" />
                                )}
                              </button>
                              <button
                                type="button"
                                data-nav-id={cadEDomId}
                                onClick={() => scrollToElement(cadEDomId)}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] flex items-center justify-between font-mono cursor-pointer transition-colors ${
                                  activeSubNavId === cadEDomId
                                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                                    : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                <span className="truncate">CAD_E Kết Cấu</span>
                                {hasCadEWarning && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-amber-400/40 shrink-0" />
                                )}
                              </button>
                              <button
                                type="button"
                                data-nav-id={elementsDomId}
                                onClick={() => scrollToElement(elementsDomId)}
                                className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] flex items-center justify-between cursor-pointer transition-colors ${
                                  activeSubNavId === elementsDomId
                                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                                    : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                <span className="truncate">Cấu kiện E ({(fl.structuralElements || []).length})</span>
                                {hasElementsWarning && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-amber-400/40 shrink-0" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Thanh công cụ Lưu / Hủy khi có thay đổi - GIỮ BẢO LƯU KHI TẮT CHẾ ĐỘ SỬA */}
          {totalPendingChanges > 0 && (
            <div className="pt-2.5 border-t border-amber-200/80 bg-amber-500/10 -mx-2.5 -mb-2.5 p-2.5 rounded-b-2xl space-y-1.5 border-b border-x border-amber-200/80 shrink-0">
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={handleReviewSave}
                  title={`Lưu Diff (${totalPendingChanges} sửa đổi)`}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{totalPendingChanges}</span>
                </button>
              ) : (
                <>
                  <div className="text-[10px] font-bold text-amber-950 flex items-center justify-between">
                    <div className="flex items-center gap-1 truncate">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="truncate">
                        {totalPendingChanges} sửa đổi
                        {stagedPhotoActions && stagedPhotoActions.length > 0 ? ` (${stagedPhotoActions.length} ảnh)` : ''}
                      </span>
                    </div>
                    {!isEditMode && (
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-200/60 px-1 py-0.5 rounded shrink-0">
                        Chưa lưu
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleDiscard(false);
                        onDiscardAllStagedPhotos?.();
                      }}
                      className="flex-1 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Hủy</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReviewSave}
                      className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>Lưu ({totalPendingChanges})</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Nội dung chi tiết 9 bước khảo sát theo đúng thứ tự chuẩn hóa */}
      <div className="flex-1 space-y-6 min-w-0 max-w-full overflow-x-hidden">
        {/* Bước 01: Nhận Diện & Hiện Trạng Tổng Quan */}
        <AuditStep1Identification
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          handleApplySyncedGeometry={handleApplySyncedGeometry}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={handleRotatePhoto}
          violationsMap={violationsMap}
        />

        {/* Bước 02: Đo Đạc Biến Dạng, Lún Nghiêng & Quan Trắc */}
        <AuditStep5SettlementTilt
          isEditMode={isEditMode}
          formState={formState}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={handleRotatePhoto}
          violationsMap={violationsMap}
        />

        {/* Bước 03: Kết Cấu Công Trình, Nền Móng & Phỏng Vấn Chủ Hộ */}
        <AuditStep2OwnerInterview
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={handleRotatePhoto}
          violationsMap={violationsMap}
        />

        {/* Bước 04: Hiện Trạng Tầng, Vùng Z & Cấu Kiện Kết Cấu E (Trải phẳng theo tầng n: CAD_Z -> Z -> CAD_E -> E) */}
        <AuditStep3FloorDefects
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          isFieldDirty={isFieldDirty}
          stagedPhotoActions={stagedPhotoActions}
          onUndoPhotoAction={onUndoPhotoAction}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={handleRotatePhoto}
          violationsMap={violationsMap}
        />

        {/* Bước 05: Khuyết Tật Bề Mặt & Tổng Hợp Nứt Burland 1977 */}
        <AuditStep4BurlandSummary
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
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
          handleApplySyncedGeometry={handleApplySyncedGeometry}
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
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
          onOpenPhotoZoom={handlePhotoZoomOrStudioSelect}
          onOpenPhotoReplace={onOpenPhotoReplace}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
          onConfirmAbsenteeSurvey={onRefresh}
          isFieldDirty={isFieldDirty}
          stagedPhotoRotations={stagedPhotoRotations}
          onRotatePhoto={handleRotatePhoto}
          violationsMap={violationsMap}
          {...({ stagedPhotoActions, onUndoPhotoAction } as Record<string, unknown>)}
        />
      </div>

      {/* Floating Pill khi đang nhấn giữ phím S */}
      {isHoldingSKey && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-black shadow-xl border border-indigo-400 flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-100">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>Chế độ chọn ảnh Studio Img (Đang giữ phím S) • Click vào ảnh bất kỳ để chọn/bỏ chọn ({selectedPhotos.length} đã chọn)</span>
        </div>
      )}

      {/* Cửa sổ Studio Img (Xử lý ảnh hàng loạt bằng công nghệ Img Lab, lưu riêng với ảnh gốc) */}
      <AuditStudioImgModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        onCommittedSuccess={(committedItems) => {
          if (committedItems && committedItems.length > 0) {
            // Thay vì gọi onRefresh() làm mất dữ liệu nháp đang sửa dở,
            // đồng bộ mảng ảnh Studio trực tiếp vào formState để hiện trong bảng Diff!
            const curEnhanced = ((formState.studioEnhancedPhotos as Record<string, any>) || {}) as Record<string, any>;
            const curByOriginal = ((formState.studioEnhancedByOriginal as Record<string, any>) || {}) as Record<string, any>;
            const nextEnhanced = { ...curEnhanced };
            const nextByOriginal = { ...curByOriginal };

            committedItems.forEach((item) => {
              nextEnhanced[item.enhancedUrl] = item;
              nextByOriginal[item.originalUrl] = item.enhancedUrl;
              if (item.previousUrl) {
                nextByOriginal[item.previousUrl] = item.enhancedUrl;
              }
            });

            handleFieldChange(
              'studioEnhancedPhotos',
              `Hiệu chỉnh ${committedItems.length} ảnh qua Studio Img`,
              nextEnhanced
            );
          }
        }}
      />

      {/* Floating Modal for Photo Orientation Guidance */}
      {isOrientationPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="overflow-y-auto p-4 scrollbar-thin">
              <PhotoOrientationAlertBanner
                violations={violations}
                onNavigateToPhoto={(v) => {
                  setIsOrientationPanelOpen(false);
                  handleNavigateToPhoto(v);
                }}
                onQuickRotate={handleQuickRotate}
                isFloatingPanel={true}
                onClose={() => setIsOrientationPanelOpen(false)}
                currentHouseOrientation={formState.houseOrientation as 'PORTRAIT' | 'LANDSCAPE' | undefined}
                onSelectHouseOrientation={(mode) => {
                  handleFieldChange('houseOrientation', 'Hướng trục chính nhà dân', mode);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

