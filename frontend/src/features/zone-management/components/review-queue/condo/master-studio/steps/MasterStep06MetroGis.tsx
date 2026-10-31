import React, { useMemo, useState } from 'react';
import { Compass, Map as MapIcon, Navigation, PenTool } from 'lucide-react';
import { CadastralBoundaryReshapeModal } from '../../../../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import type { GisParcel } from '../../../../../../../components/gis/shared/types';
import { AuditMetroSpatialVisualMap } from '../../../stepwise/components/AuditMetroSpatialVisualMap';
import { ParcelBoundaryConflictPanel } from '../../../stepwise/components/ParcelBoundaryConflictPanel';
import { useParcelBoundarySync } from '../../../stepwise/hooks/useParcelBoundarySync';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

const GIS_MUTATION_OPTIONS = [
  { value: 'NONE', label: 'Khớp ranh bản đồ địa chính gốc' },
  { value: 'BOUNDARY_ADJUST', label: 'Có điều chỉnh ranh khuôn viên thực tế' },
  { value: 'MERGE', label: 'Hợp thửa dự án chung cư' },
];

export const MasterStep06MetroGis: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  data,
  onRefresh,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
}) => {
  const gisType = formState.gisMutationConfirmed?.type;
  const { lat, lng, accuracy } = formState.gpsCoords || {};
  const [isReshapeOpen, setIsReshapeOpen] = useState(false);
  const surveyJson = (data.surveyJson || data.survey_data_json || {}) as Record<string, unknown>;
  const setField = (key: string, label: string, val: unknown) =>
    handleFieldChange(key as keyof CondoMasterFormState & string, label, val);

  const {
    hasGpmbBoundaryConflict,
    parcelCoords,
    distanceDiffPreview,
    showDistanceDiffPopover,
    setShowDistanceDiffPopover,
    handleSyncFromGis,
    handleConfirmApplySyncedGeometry,
  } = useParcelBoundarySync({
    formState,
    surveyJson,
    data,
    gpsAccuracy: accuracy,
    handleFieldChange: setField,
  });

  const reshapeParcel = useMemo<GisParcel | null>(() => {
    if (!data.parcelId) return null;
    return {
      id: data.parcelId,
      projectParcelCode: formState.projectParcelCode,
      officialCadastralCode: formState.officialCadastralCode,
      houseNumber: formState.houseNumber,
      street: formState.street,
      ownerName: formState.managementContactName,
      surveyStatus: (data.surveyStatus ?? 'SUBMITTED') as GisParcel['surveyStatus'],
      coordinates: parcelCoords,
      landArea: Number(formState.landAreaM2 || 0),
      constructionArea: Number(formState.constructionAreaM2 || 0),
      floorCount: Number(formState.aboveFloors || 1),
      buildingType: 'CONDOMINIUM',
      zoneId: data.zoneId ?? 'ZONE_01',
    };
  }, [data, formState, parcelCoords]);

  return (
    <>
      <AuditSubsection icon={Compass} title="6.1. Cự Ly Tuyến Metro & Ranh GIS">
        <ParcelBoundaryConflictPanel
          hasConflict={hasGpmbBoundaryConflict}
          isOpen={showDistanceDiffPopover}
          preview={distanceDiffPreview}
          keepConfirmed={formState.keepKsvBoundaryConfirmed}
          keepReason={formState.keepKsvBoundaryReason}
          landAreaLabel={String(formState.landAreaM2 || '---')}
          canEdit={isEditMode}
          onOpen={() => setShowDistanceDiffPopover(true)}
          onClose={() => setShowDistanceDiffPopover(false)}
          onConfirm={handleConfirmApplySyncedGeometry}
          onChangeKeepConfirmed={(val) => setField('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', val)}
          onChangeKeepReason={(val) => setField('keepKsvBoundaryReason', 'Lý do giải trình giữ ranh KSV', val)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isEditMode}
            onClick={handleSyncFromGis}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-800 bg-white border border-sky-300 rounded-lg hover:bg-sky-100 shadow-2xs transition-all ${
              isEditMode ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-sky-600" />
            <span>Đồng bộ trắc địa PostGIS</span>
          </button>
          {reshapeParcel && (
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => setIsReshapeOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-800 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 shadow-2xs transition-all ${
                isEditMode ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-amber-600" />
              <span>Nắn ranh trên bản đồ GIS</span>
            </button>
          )}
          {!isEditMode && (
            <span className="text-[11px] font-semibold text-slate-500">Bật Chế độ sửa để đồng bộ hoặc nắn ranh.</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField
            label="Khoảng cách đến tim tuyến"
            type="number"
            unit="m"
            mono
            value={formState.metroOffsetDistance}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('metroOffsetDistance')}
            onChange={(val) => handleFieldChange('metroOffsetDistance', 'Khoảng cách đến tim tuyến Metro (m)', val)}
          />
          <AuditField
            label="Khoảng cách đến mép hầm / ga (m)"
            mono
            value={formState.clearanceOffsetDistance}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('clearanceOffsetDistance')}
            onChange={(val) =>
              handleFieldChange('clearanceOffsetDistance', 'Khoảng cách đến mép hầm/nhà ga Metro (m)', val)
            }
          />
          <AuditField
            label="Xác nhận ranh địa chính GIS"
            type="select"
            value={gisType}
            options={withCurrentOption(GIS_MUTATION_OPTIONS, gisType)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('gisMutationConfirmed', 'type')}
            onChange={(val) =>
              handleNestedFieldChange('gisMutationConfirmed', 'type', 'Trạng thái biến động ranh GIS khối tháp', val)
            }
          />
          <AuditField
            label="Phạm vi khảo sát tầng hầm"
            type="select"
            value={String(Boolean(formState.surveyScope?.basement))}
            options={[
              { value: 'true', label: 'Đã khảo sát tầng hầm' },
              { value: 'false', label: 'Chưa khảo sát tầng hầm' },
            ]}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('surveyScope', 'basement')}
            onChange={(val) =>
              handleNestedFieldChange('surveyScope', 'basement', 'Phạm vi khảo sát tầng hầm', val === 'true')
            }
          />
          <AuditField
            label="Diễn giải biến động ranh GIS"
            className="md:col-span-2"
            value={formState.gisMutationConfirmed?.details as string | undefined}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('gisMutationConfirmed', 'details')}
            onChange={(val) =>
              handleNestedFieldChange('gisMutationConfirmed', 'details', 'Diễn giải biến động ranh GIS', val)
            }
          />
        </div>
      </AuditSubsection>

      {isReshapeOpen && reshapeParcel && (
        <CadastralBoundaryReshapeModal
          isOpen={isReshapeOpen}
          parcel={reshapeParcel}
          onClose={() => setIsReshapeOpen(false)}
          onSuccess={() => {
            setIsReshapeOpen(false);
            onRefresh?.();
          }}
        />
      )}

      {formState.parcelCoordinates.length >= 3 && (
        <AuditSubsection icon={MapIcon} title="6.2. Tương Quan Không Gian Với Tuyến Metro">
          <AuditMetroSpatialVisualMap
            parcelCoordinates={formState.parcelCoordinates}
            projectParcelCode={formState.projectParcelCode}
            metroOffsetDistance={formState.metroOffsetDistance}
            clearanceOffsetDistance={formState.clearanceOffsetDistance}
            gpsLocation={lat !== undefined && lng !== undefined ? { lat, lng, accuracy } : undefined}
          />
        </AuditSubsection>
      )}
    </>
  );
};
