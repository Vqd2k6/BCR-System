import React from 'react';
import { AuditPhotoCard, type AuditPhotoCardProps } from '../../stepwise/components/AuditPhotoCard';
import type {
  AuditPhotoActionParams,
  AuditPhotoHistoryParams,
  PhotoActionPayload,
} from '../../stepwise/types';
import { resolveOptimisticPhoto } from '../../stepwise/utils/optimisticPhotoResolver';

/** Nhóm props thao tác ảnh truyền chung từ step xuống mọi thẻ ảnh Chung cư. */
export interface CondoPhotoHandlers {
  isEditMode: boolean;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
}

type CondoPhotoCardProps = CondoPhotoHandlers &
  Pick<
    AuditPhotoCardProps,
    | 'url'
    | 'title'
    | 'photoCode'
    | 'category'
    | 'targetPhotoType'
    | 'targetPhotoId'
    | 'defectId'
    | 'defectCode'
    | 'zoneCode'
    | 'photoIndex'
    | 'hasHistory'
    | 'historyCount'
    | 'aspectRatio'
    | 'maxHeightPx'
    | 'badgeColor'
    | 'className'
  >;

/** `AuditPhotoCard` kèm hiển thị tức thời ảnh chờ lưu (thay, thêm, xóa) như các step Nhà dân. */
export const CondoPhotoCard: React.FC<CondoPhotoCardProps> = ({
  url,
  isEditMode,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  ...cardProps
}) => {
  const optimistic = resolveOptimisticPhoto(url, stagedPhotoActions, {
    category: cardProps.category,
    targetPhotoType: cardProps.targetPhotoType,
    targetPhotoId: cardProps.targetPhotoId,
    defectId: cardProps.defectId,
    zoneCode: cardProps.zoneCode,
    photoIndex: cardProps.photoIndex,
  });
  const stagedAction = optimistic.stagedAction;

  return (
    <AuditPhotoCard
      {...cardProps}
      url={optimistic.status === 'DELETED' ? '' : optimistic.displayUrl}
      isEditMode={isEditMode}
      optimisticStatus={
        optimistic.status === 'REPLACED' || optimistic.status === 'ADDED' || optimistic.status === 'DELETED'
          ? optimistic.status
          : undefined
      }
      onUndoDelete={stagedAction && onUndoPhotoAction ? () => onUndoPhotoAction(stagedAction) : undefined}
      onOpenPhotoZoom={onOpenPhotoZoom}
      onOpenPhotoAction={onOpenPhotoAction}
      onOpenPhotoHistory={onOpenPhotoHistory}
    />
  );
};
