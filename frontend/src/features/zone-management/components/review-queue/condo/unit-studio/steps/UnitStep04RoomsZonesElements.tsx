import React from 'react';
import { AlertTriangle, Layers, Map as MapIcon, Upload } from 'lucide-react';
import { AuditField } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoStructuralElementsCrudEditor } from '../../core/CondoStructuralElementsCrudEditor';
import { CondoZoneCadSection } from '../../core/CondoZoneCadSection';
import { CondoZonesDefectsCrudEditor } from '../../core/CondoZonesDefectsCrudEditor';
import { useCondoCadPins } from '../../core/useCondoCadPins';
import { useCondoZoneBoardActions } from '../../core/useCondoZoneBoardActions';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep04RoomsZonesElements: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  const photoHandlers = {
    isEditMode,
    stagedPhotoActions,
    onUndoPhotoAction,
    onOpenPhotoZoom,
    onOpenPhotoAction,
    onOpenPhotoHistory,
  };
  const defaultFloorName = formState.floorNumber !== null ? `Tầng ${formState.floorNumber}` : '';
  const pinControls = useCondoCadPins({
    isEditMode,
    cadUrl: formState.roomLayoutUrl,
    structuralCadUrl: formState.structuralCadUrl,
    cadZonePins: formState.cadZonePins,
    cadElementPins: formState.cadElementPins,
    photoRotations: formState.photoRotations,
    handleFieldChange,
  });
  const onChangeZones = (nextZones: CondoUnitFormState['damageZones'], actionLabel: string) =>
    handleFieldChange('damageZones', actionLabel, nextZones);
  const zoneActions = useCondoZoneBoardActions({
    zones: formState.damageZones,
    defaultFloorName,
    zoneBoard: pinControls.zoneBoard,
    onChangeZones,
  });

  return (
    <>
      <AuditSubsection icon={MapIcon} title="4.1. Bản Vẽ CAD Căn Hộ" hint="Phiếu KSV: Bước 3">
        {formState.isFloorCadFallback && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Căn hộ chưa có CAD riêng, đang hiển thị mặt bằng CAD của tầng.</span>
          </div>
        )}
        {isEditMode && onOpenPhotoAction && (
          <button
            type="button"
            onClick={() =>
              onOpenPhotoAction({
                initialMode: formState.roomLayoutUrl ? 'REPLACE' : 'ADD',
                category: 'CAD_FLOOR',
                targetPhotoType: 'UNIT_LAYOUT_SKETCH',
                currentPhotoCode: 'UNIT-LAYOUT',
                photoTitle: `Sơ đồ mặt bằng căn hộ ${formState.unitCode}`,
                currentPhotoUrl: formState.roomLayoutUrl || undefined,
              })
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{formState.roomLayoutUrl ? 'Cập nhật sơ đồ' : 'Tải lên sơ đồ căn hộ'}</span>
          </button>
        )}
        <CondoZoneCadSection
          zones={formState.damageZones}
          zoneActions={zoneActions}
          pinControls={pinControls}
          isEditMode={isEditMode}
          onOpenPhotoZoom={onOpenPhotoZoom}
        />
        {(isEditMode || formState.roomLayoutNotes) && (
          <AuditField
            label="Ghi chú bố trí phòng"
            type="textarea"
            value={formState.roomLayoutNotes}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('roomLayoutNotes')}
            onChange={(val) => handleFieldChange('roomLayoutNotes', 'Ghi chú sơ đồ phòng căn hộ', val)}
          />
        )}
      </AuditSubsection>

      <AuditSubsection icon={Layers} title="4.2. Vùng Hư Hại Kiến Trúc (Z)" hint="Phiếu KSV: Bước 3">
        <CondoZonesDefectsCrudEditor
          {...photoHandlers}
          zones={formState.damageZones}
          pinControls={pinControls}
          zoneActions={zoneActions}
          onChangeZones={onChangeZones}
        />
      </AuditSubsection>

      <AuditSubsection icon={Layers} title="4.3. Cấu Kiện Chịu Lực (E)" hint="Phiếu KSV: Bước 3">
        <CondoStructuralElementsCrudEditor
          {...photoHandlers}
          elements={formState.structuralElements}
          defaultFloorName={defaultFloorName}
          pinControls={pinControls}
          onChangeElements={(nextElements, actionLabel) =>
            handleFieldChange('structuralElements', actionLabel, nextElements)
          }
        />
      </AuditSubsection>
    </>
  );
};
