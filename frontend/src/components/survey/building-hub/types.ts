import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';

export type { BuildingUnit };

export interface BuildingHubModalProps {
  parcel: GisParcel;
  onClose: () => void;
  onStartMasterSurvey: (parcel: GisParcel, readOnly?: boolean) => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onUnitsUpdated?: () => void;
}

export interface MasterReportData {
  status?: string;
  building_type?: string;
  buildingSpecs?: {
    floor_count?: number;
    basement_count?: number;
    foundation_category?: string;
    structural_system?: string;
  };
  identificationPhotos?: unknown[];
  summary_conclusions?: string;
}
