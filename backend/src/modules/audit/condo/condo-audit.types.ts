/**
 * ============================================================================
 * CONDO AUDIT MODULE — STRICT TYPESCRIPT DEFINITIONS (ZERO-ANY)
 * Định nghĩa toàn bộ kiểu dữ liệu cho Phân hệ Thẩm định Chung cư (Độc lập 100% với Nhà dân)
 * ============================================================================
 */

export type CondoEntityKind = 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT';
export type CondoAuditEntityKind = CondoEntityKind;

export interface CondoReportContextRow {
  report_id: string;
  parcel_id: string;
  unit_id: string | null;
  report_type: string | null;
  status: string;
  is_refused_or_absent: boolean;
  survey_date: string | null;
  surveyor_id: string | null;
  surveyor_name: string | null;
  surveyor_phone: string | null;
  surveyor_signature_url: string | null;
  owner_signature_url: string | null;
  owner_remarks: string | null;
  summary_conclusions: string | null;
  engineering_recommendations: string | null;
  rejection_reason: string | null;
  official_pdf_url: string | null;
  export_revision: number;
  survey_data_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Parcel fields
  project_parcel_code: string;
  official_cadastral_code: string | null;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  zone_id: string;
  building_type: string | null;
  parcel_owner_name: string | null;
  parcel_owner_phone: string | null;
  frontage_width: number | null;
  lot_depth: number | null;
  land_area_m2: number | null;
  construction_area_m2: number | null;
  floor_count: number | null;
  total_units: number | null;
  distance_to_centerline_m: number | null;
  mutation_type: string | null;
  cadastral_geojson: string | null;
  location_geojson: string | null;
  is_locked: boolean;
  locked_at: string | null;
  seal_hash: string | null;
  seal_notes: string | null;
  // Unit fields (if unit_id IS NOT NULL)
  unit_code: string | null;
  display_code: string | null;
  unit_type: string | null;
  floor_number?: number | null;
  unit_floor_number: number | null;
  unit_status: string | null;
  unit_owner_name: string | null;
  unit_owner_phone: string | null;
  unit_owner_id_card: string | null;
  unit_resident_status: string | null;
  floor_plan_id: string | null;
}

export interface CondoParentMasterSummary {
  hasMasterReport: boolean;
  masterReportId: string | null;
  masterStatus: string;
  isMasterApproved: boolean;
  buildingName: string | null;
  projectParcelCode: string;
  addressText: string;
  standardizedAddress: string | null;
  aboveFloors: number | null;
  undergroundFloors: number | null;
  constructionYear: number | null;
  structureSystem: string | null;
  foundationType: string | null;
  foundationCatScore: number;
  foundationDepthM: number | string | null;
  metroOffsetDistance: string | number | null;
  clearanceOffsetDistance: string | number | null;
  buildingTilt: {
    level: number;
    xPermille: number | string | null;
    yPermille: number | string | null;
    direction: string | null;
  };
  diffSettlement: {
    level: number;
    position: string | null;
  };
  scores: {
    totalEcs: number | null;
    ecsClass: string | null;
    avgVi: number | null;
    viClass: string | null;
    braStatus: string | null;
    impactStatus: string | null;
  };
  managementBoard: {
    contactName: string | null;
    contactPhone: string | null;
    contactRole: string | null;
  };
}

export interface CondoFloorPlanRecord {
  id: string;
  parcel_id: string;
  floor_number: number;
  floor_name: string;
  cad_photo_url: string | null;
  is_typical_floor: boolean;
  typical_floor_range: string | null;
  notes: string | null;
  historyCount?: number;
  hasHistory?: boolean;
  history?: unknown[];
}

export interface CondoDiffItem {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  isPhoto?: boolean;
}

export interface CondoPhotoActionItem {
  action: 'ADD' | 'DELETE' | 'REPLACE' | 'ROTATE' | 'RESTORE';
  category: string;
  targetPhotoType?: string;
  targetPhotoId?: string;
  defectId?: string;
  defectCode?: string;
  zoneCode?: string;
  floorCode?: string;
  photoIndex?: number;
  oldPhotoUrl?: string;
  newPhotoUrl?: string;
  newPhotoUrls?: string[];
  photoCode?: string;
  photoType?: string;
  standardizedFilename?: string;
  sha256Hash?: string;
  sizeBytes?: number;
  mimeType?: string;
  caption?: string;
  reason: string;
  editReason?: string;
  rotation?: number;
  pinX?: number;
  pinY?: number;
  widthMaxMm?: number;
  lengthMm?: number;
  metadata?: Record<string, unknown>;
}

export interface CondoModifyPayload {
  adminPassword?: string;
  editReason: string;
  diffPayload: CondoDiffItem[];
  updates: Record<string, unknown>;
  photoActions?: CondoPhotoActionItem[];
}

export type CondoAdminEditPayload = CondoModifyPayload;

export interface CondoRollbackPayload {
  password?: string;
  adminPassword?: string;
  reason: string;
  confirmZoneWipe?: boolean;
}

export interface CondoWarningFlag {
  code: string;
  level: 'WARNING' | 'INFO';
  message: string;
}

export interface CondoFloorMatrixRow {
  floorNumber: number;
  floorName: string;
  floorPlanId?: string | null;
  cadPhotoUrl: string | null;
  totalMasterAreas?: number;
  approvedMasterAreas?: number;
  pendingMasterAreas?: number;
  masterAreasCount: number;
  totalUnits: number;
  approvedUnits: number;
  pendingUnits: number;
  submittedUnits?: number;
  underReviewUnits?: number;
  absentUnits: number;
  absentVerifiedUnits?: number;
  rejectedUnits?: number;
  criticalUnits: number;
  criticalCount?: number;
  maxBurlandGrade?: number;
  units: Array<{
    unitId: string;
    unitCode: string;
    unitType: 'MASTER_AREA' | 'CONDO_UNIT';
    status: string;
    reportId: string | null;
    burlandScore: number | null;
    ownerName: string | null;
  }>;
}
