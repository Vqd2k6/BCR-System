// Core Domain Types for Metro Survey System

export type UserRole = 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedZoneId?: string | null;
  phone?: string | null;
  surveyorCode?: string | null;
  signatureImageUrl?: string | null;
}

export type User = UserProfile;

export type SurveyStatus =
  | 'NOT_SURVEYED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTPONED_ABSENT'
  | 'UNDER_CONSTRUCTION'
  | 'COMPLETED'
  | 'SURVEYED'
  | 'ABSENT'
  | 'REFUSED'
  | 'EXPORTED'
  | 'PHASE2_COMPLETED'
  | 'APPROVED_PHASE2'
  | 'SPLIT_DEPRECATED'
  | 'MERGED_DEPRECATED';

export interface GisParcel {
  id: string;
  projectParcelCode: string;
  project_parcel_code?: string;
  projectCode?: string;
  officialCadastralCode: string;
  official_cadastral_code?: string;
  buildingName?: string;
  building_name?: string;
  houseNumber: string;
  house_number?: string;
  street: string;
  ward?: string;
  ward_name?: string;
  district?: string;
  district_name?: string;
  ownerName?: string;
  owner_name?: string;
  ownerPhone?: string;
  owner_phone?: string;
  surveyStatus?: SurveyStatus;
  survey_status?: SurveyStatus;
  absenceAttemptCount?: number;
  absence_attempt_count?: number;
  coordinates: [number, number][];
  adjacentType?: string;
  adjacent_type?: string;
  constructionArea?: number;
  construction_area_m2?: number;
  constructionAreaM2?: number;
  floorCount?: number;
  floor_count?: number;
  aboveFloors?: number;
  above_floors?: number;
  basementFloors?: number;
  basement_floors?: number;
  buildingHeightM?: number;
  building_height_m?: number;
  frontageWidth?: number;
  frontage_width?: number;
  lotDepth?: number;
  lot_depth?: number;
  landArea?: number;
  land_area_m2?: number;
  landAreaM2?: number;
  landCategory?: string;
  land_category?: string;
  landUseName?: string;
  land_use_name?: string;
  buildingType?: string;
  building_type?: string;
  totalUnits?: number;
  total_units?: number;
  completedUnits?: number;
  completed_units?: number;
  deletedFloors?: number[];
  deleted_floors?: number[];
  distanceMeters?: number;
  distance_meters?: number;
  distance_to_centerline_m?: number;
  chainage?: string;
  updatedAt?: string | Date;
  updated_at?: string | Date;
  zoneId?: string;
  zone_id?: string;
  assignedSurveyorId?: string;
  assigned_surveyor_id?: string;
  assignedSurveyorName?: string;
  assigned_surveyor_name?: string;
  assignedSurveyorCode?: string;
  assigned_surveyor_code?: string;
  assignedSurveyorPhone?: string;
  assigned_surveyor_phone?: string;
  rejectionReason?: string;
  rejection_reason?: string;
  activePhase1ReportId?: string;
  activePhase2ReportId?: string;
  lifecycleStatus?: 'ACTIVE' | 'PENDING_MUTATION_APPROVAL' | 'SPLIT_DEPRECATED' | 'MERGED_DEPRECATED';
  mutationType?: 'SPLIT' | 'MERGE' | null;
  parentParcelIds?: string[];
  childParcelIds?: string[];
  postponed_at?: string | Date;
  parcelType?: string;
  parcel_type?: string;
  land_use_category?: string;
  land_use_name_raw?: string;
  braRiskLevel?: string;
  bra_risk_level?: string;
  braStatus?: string;
  bra_status?: string;
}

export interface BuildingUnit {
  id: string;
  parcelId?: string;
  parcel_id?: string;
  unitCode?: string;
  unit_code?: string;
  unitName?: string;
  unit_name?: string;
  unitType?: 'APARTMENT' | 'SHOPTOP' | 'OFFICE' | 'COMMERCIAL' | 'OTHER';
  unit_type?: string;
  floorLevel?: string;
  floor_level?: string;
  floorNumber?: number;
  floor_number?: number;
  ownerName?: string;
  owner_name?: string;
  ownerPhone?: string;
  owner_phone?: string;
  ownerIdCard?: string;
  owner_id_card?: string;
  residentStatus?: string;
  resident_status?: string;
  unitCadUrl?: string;
  unit_cad_url?: string;
  cadBbox?: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null;
  cad_bbox?: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null;
  cadPolygon?: [number, number][] | { x: number; y: number }[] | null;
  cad_polygon?: [number, number][] | { x: number; y: number }[] | null;
  status?: string;
  surveyStatus?: SurveyStatus;
  survey_status?: SurveyStatus;
  phase1_report_id?: string | null;
  phase1ReportId?: string | null;
  phase2_report_id?: string | null;
  phase2ReportId?: string | null;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

