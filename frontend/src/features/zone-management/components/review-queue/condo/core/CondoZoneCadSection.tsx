import React from 'react';
import type { CondoDamageZoneItemData } from '../types/condo-audit.types';
import { CondoCadPinSection } from './CondoCadPinSection';
import type { CondoCadPinControls } from './useCondoCadPins';
import type { CondoZoneBoardActions } from './useCondoZoneBoardActions';

interface CondoZoneCadSectionProps {
  zones: CondoDamageZoneItemData[];
  zoneActions: CondoZoneBoardActions;
  pinControls: CondoCadPinControls;
  isEditMode: boolean;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
}

export const CondoZoneCadSection: React.FC<CondoZoneCadSectionProps> = ({
  zones,
  zoneActions,
  pinControls,
  isEditMode,
  onOpenPhotoZoom,
}) => (
  <CondoCadPinSection
    board={pinControls.zoneBoard}
    tone="zone"
    title="CAD Kiến trúc (Z)"
    activeCodes={zones.filter((z) => !z.isDeleted).map((z) => z.zoneCode)}
    isEditMode={isEditMode}
    canUndo={pinControls.undoState.canUndo}
    onUndo={pinControls.undoState.undo}
    onAddAt={(x, y) => zoneActions.addZone({ x, y })}
    onSelectPin={zoneActions.selectZonePin}
    onOpenPhotoZoom={onOpenPhotoZoom}
  />
);
