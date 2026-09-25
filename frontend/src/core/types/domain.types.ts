// Core Domain Types for Metro Survey System

export type UserRole = 'SURVEYOR' | 'ZONE_MANAGER' | 'SUPER_ADMIN' | 'GUEST';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedZone?: string;
  phone?: string;
}

export type SurveyStatus =
  | 'NOT_SURVEYED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTPONED_ABSENT'
  | 'UNDER_CONSTRUCTION'
  | 'COMPLETED'
  | 'ABSENT'
  | 'REFUSED'
  | 'EXPORTED'
  | 'PHASE2_COMPLETED'
  | 'APPROVED_PHASE2';

export interface GisParcel {
  id: string;
  projectParcelCode?: string;
  officialCadastralCode?: string;
  houseNumber?: string;
  street?: string;
  ownerName?: string;
  surveyStatus?: SurveyStatus;
  absenceAttemptCount?: number;
  coordinates: [number, number][];
  adjacentType?: string;
  constructionArea?: number;
  floorCount?: number;
  landArea?: number;
  landCategory?: string;
  landUseName?: string;
  buildingType?: string;
  totalUnits?: number;
  completedUnits?: number;
  updatedAt?: string | Date;
  zoneId?: string;
}

export interface BuildingUnit {
  id: string;
  parcelId: string;
  unitCode: string;
  unitName: string;
  unitType: 'APARTMENT' | 'SHOPTOP' | 'OFFICE' | 'COMMERCIAL' | 'OTHER';
  floorLevel: string;
  ownerName: string;
  ownerPhone?: string;
  surveyStatus: SurveyStatus;
  updatedAt?: string;
}
