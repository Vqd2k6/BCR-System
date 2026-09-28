import { GisParcel } from '../../gis/LeafletSweepMap';

export interface BuildingUnit {
  id: string;
  parcel_id: string;
  unit_code: string;
  floor_number: number;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_id_card?: string | null;
  status: string;
  phase1_report_id?: string | null;
  phase2_report_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BuildingHubModalProps {
  parcel: GisParcel;
  onClose: () => void;
  onStartMasterSurvey: (parcel: GisParcel) => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onUnitsUpdated?: () => void;
}
