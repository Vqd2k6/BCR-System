import React from 'react';
import { Layers, Map as MapIcon, Upload } from 'lucide-react';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoStructuralElementsCrudEditor } from '../../core/CondoStructuralElementsCrudEditor';
import { CondoZonesDefectsCrudEditor } from '../../core/CondoZonesDefectsCrudEditor';
import { useCondoCadPins } from '../../core/useCondoCadPins';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep04ZonesElements: React.FC<CondoAuditStepProps<CondoAreaFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
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
  const defaultFloorName =
    formState.floorNumber < 0 ? `Hầm B${Math.abs(formState.floorNumber)}` : `Tầng ${formState.floorNumber}`;
  const cadUrl = formState.croppedCadUrl || formState.sketchCadUrl || formState.floorCadUrl;
  const pinControls = useCondoCadPins({
    isEditMode,
    cadUrl,
    structuralCadUrl: formState.structuralCadUrl,
    cadZonePins: formState.cadZonePins,
    cadElementPins: formState.cadElementPins,
    photoRotations: formState.photoRotations,
    handleFieldChange,
  });

  return (
    <>
      <AuditSubsection icon={MapIcon} title="4.1. Bản Vẽ CAD Phân Vùng">
        {isEditMode && onOpenPhotoAction && (
          <button
            type="button"
            onClick={() =>
              onOpenPhotoAction({
                initialMode: formState.croppedCadUrl ? 'REPLACE' : 'ADD',
                category: 'CAD_FLOOR',
                targetPhotoType: 'CROPPED_CAD_PHOTO',
                currentPhotoUrl: formState.croppedCadUrl || undefined,
                currentPhotoCode: `${formState.unitCode}-CAD`,
                photoTitle: `Sơ đồ mặt bằng phân vùng ${formState.unitCode}`,
              })
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{formState.croppedCadUrl ? 'Cập nhật bản vẽ' : 'Tải lên bản vẽ'}</span>
          </button>
        )}
      </AuditSubsection>

      <AuditSubsection icon={Layers} title="4.2. Vùng Hư Hại Kiến Trúc (Z)">
        <CondoZonesDefectsCrudEditor
          {...photoHandlers}
          zones={formState.damageZones}
          defaultFloorName={defaultFloorName}
          pinControls={pinControls}
          onChangeZones={(nextZones, actionLabel) => handleFieldChange('damageZones', actionLabel, nextZones)}
        />
      </AuditSubsection>

      <AuditSubsection icon={Layers} title="4.3. Cấu Kiện Chịu Lực (E)">
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
