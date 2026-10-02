export interface GisParcel {
  id: string;
  projectParcelCode: string;
  officialCadastralCode: string;
  houseNumber: string;
  street: string;
  ownerName?: string;
  ownerPhone?: string;
  surveyStatus:
    | 'NOT_SURVEYED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'POSTPONED_ABSENT'
    | 'UNDER_CONSTRUCTION'
    | 'PHASE2_COMPLETED'
    | 'APPROVED_PHASE2';
  absenceAttemptCount?: number;
  coordinates: [number, number][]; // LatLng polygon
  distanceMeters?: number;
  adjacentType?: string;
  constructionArea?: number;
  floorCount?: number;
  landArea?: number;
  landCategory?: string;
  landUseName?: string;
  buildingType?: 'STANDALONE' | 'CONDOMINIUM' | 'ROW_HOUSE';
  totalUnits?: number;
  completedUnits?: number;
  updatedAt?: string;
  zoneId?: string;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  assignedSurveyorCode?: string;
  assignedSurveyorPhone?: string;
}

export interface SplitChildData {
  label: string;
  houseNumber: string;
  ownerName: string;
  suggestedCode: string;
  areaM2?: number;
  polygonRatio?: number;
  functionalType?: string;
  isResidualSurplus?: boolean;
  residualKind?: 'NON_BUILDING' | 'NEW_BUILDING';
  residualParentParcelCode?: string;
  residualParentCadastralCode?: string;
  residualParentAddress?: string;
  residualMetadataNote?: string;
  coordinates?: [number, number][]; // Tọa độ đa giác riêng của lô đất con
}

export interface MaxZoneCodeInfo {
  currentMaxCode: string;
  nextCode: string;
  zoneId: string;
  mechanism: string;
  description?: string;
}

export interface MutationPayloadData {
  splitReason: string;
  splitCount: number;
  splitChildren: SplitChildData[];
  splitCutRatio?: number;
  splitCutType?: 'HORIZONTAL' | 'VERTICAL' | 'L_SHAPE' | 'CUSTOM_POINTS';
  splitShapeOption?: 'DRAG_HANDLES' | 'CLICK_TO_DRAW';
  residualKind?: 'NON_BUILDING' | 'NEW_BUILDING';
  splitCustomPointsA?: [number, number][];
  splitCustomPointsB?: [number, number][]; // Tọa độ đa giác của phần đất dôi dư Căn B
  mergeReason: string;
  mergeTargetCode?: string;
  selectedMergeCodes?: string[];
  mergeHasPartialBuilding?: boolean;
  mergeBuildingAreaM2?: number;
  mergeResidualAreaM2?: number;
  mergeResidualType?: string;
  customMergeResidualType?: string;
  mergeBuildingRatio?: number;
  mergeResidualParcelCode?: string;
  mergeBuildingCustomPoints?: [number, number][];
  mergeResidualCustomPoints?: [number, number][]; // Tọa độ đa giác phần đất dư ngoài công trình
  activeProposalType?: 'MATCH' | 'SPLIT' | 'MERGE' | null;
  // Flat legacy compatibility fields
  portionAAreaM2?: number;
  portionBAreaM2?: number;
  portionAPolygon?: [number, number][];
  portionBPolygon?: [number, number][];
  splitType?: 'NON_BUILDING' | 'NEW_BUILDING' | string;
  mergeWithParcelCodes?: string[];
  finalMergedLandAreaM2?: number;
  mergeBuildingPolygon?: [number, number][];
  mergeResidualPolygon?: [number, number][];
  isSubmitted?: boolean;
  submittedAt?: string;
  matchConfirmed?: boolean;
}

export interface CadastralParcelData {
  id?: string;
  projectParcelCode: string;
  officialCadastralCode: string;
  houseNumber: string;
  street: string;
  ward?: string;
  district?: string;
  ownerName?: string;
  landArea?: number;
  constructionArea?: number;
  buildingHeight?: number;
  frontageWidth?: number;
  lotDepth?: number;
  floorCount?: number;
  gpsCoords?: string;
  zoneId?: string;
  coordinates?: [number, number][];
}

export interface CadastralBoundaryEditorProps {
  activeParcelId: string;
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  onStatusChange: (status: 'MATCH' | 'SPLIT' | 'MERGE') => void;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

export interface LeafletSweepMapProps {
  parcels: GisParcel[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onSelectParcel: (parcel: GisParcel) => void;
  onStartSurvey?: (parcel: GisParcel, readOnly?: boolean) => void;
  onOpenBuildingHub?: (parcel: GisParcel) => void;
  onRecordAbsence?: (parcel: GisParcel) => void;
  onProposeSplit?: (parcel: GisParcel) => void;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
}
