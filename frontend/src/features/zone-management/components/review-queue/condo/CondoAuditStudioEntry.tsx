import React from 'react';
import type { AuditStepwiseData } from '../stepwise/types';
import type {
  CondoEntityKind,
  CondoStudioEntryProps,
} from './types/condo-audit.types';
import { CondoMasterStepwiseView } from './master-studio/CondoMasterStepwiseView';
import { CondoMasterAreaStepwiseView } from './area-studio/CondoMasterAreaStepwiseView';
import { CondoUnitStepwiseView } from './unit-studio/CondoUnitStepwiseView';
import {
  AuditStudioImgProvider,
  useAuditStudioImg,
  type StudioCommittedPhotoInfo,
} from '../stepwise/context/AuditStudioImgContext';
import { AuditStudioImgModal } from '../stepwise/components/AuditStudioImgModal';

/**
 * Bộ nhận diện tự động phân hệ Chung cư (Strategy Classifier trên Frontend)
 * Trả về 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT' hoặc null nếu là Nhà dân (STANDALONE).
 */
export function resolveCondoEntityKind(
  data?: AuditStepwiseData | null
): CondoEntityKind | null {
  if (!data) return null;

  const rawEntityKind = (data as Record<string, unknown>).condoEntityKind as
    | CondoEntityKind
    | undefined;
  if (
    rawEntityKind === 'BUILDING_MASTER' ||
    rawEntityKind === 'MASTER_AREA' ||
    rawEntityKind === 'CONDO_UNIT'
  ) {
    return rawEntityKind;
  }

  // unit_type là nguồn chuẩn; tiền tố mã chỉ áp dụng cho bản ghi chưa có unit_type
  const unitType = data.unitInfo?.unit_type;
  const isMasterArea = Boolean(
    unitType === 'MASTER' ||
      data.reportType === 'MASTER_AREA' ||
      (!unitType &&
        (data.unitInfo?.unit_code?.startsWith('M-') ||
          data.unitInfo?.unit_code?.startsWith('MA-')))
  );
  if (isMasterArea) return 'MASTER_AREA';

  const isCondoUnit = Boolean(
    data.unitInfo?.unit_type === 'UNIT' ||
      data.reportType === 'CONDO_UNIT' ||
      data.reportType === 'UNIT_CHILD' ||
      data.unitInfo?.unit_code?.startsWith('U-') ||
      Boolean(data.unitId)
  );
  if (isCondoUnit) return 'CONDO_UNIT';

  const isCondoMaster = Boolean(
    (data.buildingType?.includes('CONDO') ||
      data.parentBuildingInfo?.buildingType?.includes('CONDO')) &&
      !data.unitId &&
      (data.reportType === 'CONDO_MASTER' ||
        data.reportType === 'BUILDING_MASTER' ||
        !data.reportType)
  );
  if (isCondoMaster) return 'BUILDING_MASTER';

  return null;
}

export const CondoAuditStudioEntry: React.FC<CondoStudioEntryProps> = (props) => {
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
      <CondoAuditStudioEntryInner {...props} />
    </AuditStudioImgProvider>
  );
};

const CondoAuditStudioEntryInner: React.FC<CondoStudioEntryProps> = (props) => {
  const kind = resolveCondoEntityKind(props.data) || 'CONDO_UNIT';
  const {
    isHoldingSKey,
    selectedPhotos,
    toggleSelectPhoto,
    resolveEffectiveStudioUrl,
    isStudioModalOpen,
    setIsStudioModalOpen,
  } = useAuditStudioImg();

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
      props.onOpenPhotoZoom(effectiveUrl, title, photoCode, rotation);
    },
    [isHoldingSKey, resolveEffectiveStudioUrl, toggleSelectPhoto, props]
  );

  const studioCommitHandlerRef = React.useRef<((items: StudioCommittedPhotoInfo[]) => void) | null>(null);
  const registerStudioCommitHandler = React.useCallback(
    (handler: (items: StudioCommittedPhotoInfo[]) => void) => {
      studioCommitHandlerRef.current = handler;
    },
    []
  );

  const enhancedProps: CondoStudioEntryProps = {
    ...props,
    onOpenPhotoZoom: handlePhotoZoomOrStudioSelect,
    registerStudioCommitHandler,
  };

  return (
    <>
      {kind === 'BUILDING_MASTER' ? (
        <CondoMasterStepwiseView {...enhancedProps} />
      ) : kind === 'MASTER_AREA' ? (
        <CondoMasterAreaStepwiseView {...enhancedProps} />
      ) : (
        <CondoUnitStepwiseView {...enhancedProps} />
      )}

      <AuditStudioImgModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        onCommittedSuccess={(committedItems) => {
          if (committedItems && committedItems.length > 0) {
            studioCommitHandlerRef.current?.(committedItems);
          }
        }}
      />
      {isHoldingSKey && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-black shadow-xl border border-indigo-400 flex items-center gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-100">
          <span>Chế độ chọn ảnh Studio Img (Đang giữ phím S) • Click vào ảnh bất kỳ để chọn/bỏ chọn ({selectedPhotos.length} đã chọn)</span>
        </div>
      )}
    </>
  );
};

