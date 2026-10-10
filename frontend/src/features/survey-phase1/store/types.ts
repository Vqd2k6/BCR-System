import type { Phase1SurveyFormData } from '../types/phase1.types';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import type { MissingFieldItem } from '../utils/stepValidator';

export interface NavigationSliceState {
  currentStep: number;
  missingModal: { isOpen: boolean; missingFields: MissingFieldItem[]; targetStep: number } | null;
}

export interface NavigationSliceActions {
  setCurrentStep: (step: number) => void;
  requestStepNavigation: (targetStep: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  closeMissingModal: () => void;
  proceedAnyway: () => void;
  focusMissingField: (item: MissingFieldItem) => void;
  validateForFinalSubmit: () => boolean;
}

export type NavigationSlice = NavigationSliceState & NavigationSliceActions;

export interface SyncSliceState {
  syncStatus: 'IDLE' | 'SYNCING' | 'SAVED' | 'OFFLINE' | 'ERROR';
  lastSyncedAt: string | null;
  syncVersion: number;
  isDirty: boolean;
  isLockedByOther: boolean;
  lockedInfo: { surveyorName: string; phone?: string; minutesAgo: number; message?: string } | null;
  isHandoverModalOpen: boolean;
  handoverInfo: {
    fromSurveyorName: string;
    fromSurveyorPhone?: string;
    currentStep: number;
    securityCode: string;
    updatedAt: string;
  } | null;
}

export interface SyncSliceActions {
  syncDraftToServer: () => Promise<void>;
  releaseDraftLock: () => Promise<void>;
  takeoverDraft: (handoverCode: string, note?: string) => Promise<boolean>;
  closeHandoverModal: () => void;
  closeLockedModal: () => void;
  setIsDirty: (isDirty: boolean) => void;
}

export type SyncSlice = SyncSliceState & SyncSliceActions;

export interface FormSliceState {
  currentUnitId: string | null;
  formData: Phase1SurveyFormData;
  isSavingDraft: boolean;
  lastSavedAt: string | null;
  activeParcel: GisParcel | null;
  isReadOnly: boolean;
  isSubmitted: boolean;
}

export interface FormSliceActions {
  setIsReadOnly: (isReadOnly: boolean) => void;
  setIsSubmitted: (isSubmitted: boolean) => void;
  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => void;
  updateFormData: (updater: Partial<Phase1SurveyFormData> | ((prev: Phase1SurveyFormData) => Phase1SurveyFormData)) => void;
  loadReportData: (serverFormData: Partial<Phase1SurveyFormData>) => void;
  saveDraftToStorage: () => void;
  clearDraft: (preserveSubmittedStatus?: boolean) => void;
  recalculateScores: () => void;
}

export type FormSlice = FormSliceState & FormSliceActions;

export type Phase1SurveyStore = NavigationSlice & SyncSlice & FormSlice;
