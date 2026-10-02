import { create } from 'zustand';
import { Phase1SurveyStore } from './types';
import { getDefaultInitialFormData } from './initialFormData';
import { createNavigationSlice } from './slices/navigationSlice';
import { createSyncSlice } from './slices/syncSlice';
import { createFormSlice } from './slices/formSlice';

export { getDefaultInitialFormData };
export type { Phase1SurveyStore };

export const usePhase1SurveyStore = create<Phase1SurveyStore>((...a) => ({
  ...createNavigationSlice(...a),
  ...createSyncSlice(...a),
  ...createFormSlice(...a),
}));
