import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { api } from '../../../services/api';
import type { Phase1SurveyFormData } from '../types/phase1.types';

export interface DraftResponseData {
  hasDraft: boolean;
  isLocked?: boolean;
  requiresHandover?: boolean;
  activeSurveyorName?: string;
  activeSurveyorPhone?: string;
  minutesAgo?: number;
  fromSurveyorName?: string;
  fromSurveyorPhone?: string;
  currentStep?: number;
  securityCode?: string;
  updatedAt?: string;
  syncVersion?: number;
  message?: string;
  draft?: {
    reportId: string;
    currentStep: number;
    surveyData: Partial<Phase1SurveyFormData> | Record<string, unknown>;
    syncVersion: number;
    updatedAt: string;
  };
}

export interface SaveDraftPayload {
  parcelId: string;
  unitId?: string | null;
  reportType?: string;
  currentStep: number;
  surveyData: Partial<Phase1SurveyFormData> | Record<string, unknown>;
  syncVersion?: number;
}

export interface TakeoverDraftPayload {
  parcelId: string;
  unitId?: string | null;
  handoverCode: string;
  note?: string;
}

export const surveyDraftService = {
  /**
   * Truy vấn bản nháp hiện tại của công trình từ server
   */
  async fetchDraft(parcelId: string, unitId?: string | null): Promise<DraftResponseData> {
    try {
      const res = await api.get(`/surveys/draft/${parcelId}`, {
        params: unitId ? { unitId } : {},
      });
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        // Coi như công trình chưa có bản nháp trên server để tiến trình khảo sát diễn ra mượt mà
        return { hasDraft: false };
      }
      throw err;
    }
  },

  /**
   * Lưu bản nháp (Full Phase Snapshot) lên server
   */
  async saveDraft(payload: SaveDraftPayload) {
    const res = await api.post('/surveys/draft/save', payload);
    return res.data?.data || res.data;
  },

  /**
   * KSV chủ động bấm mở khóa ca / kết thúc ca để đồng đội tiếp quản ngay lập tức
   */
  async releaseLock(parcelId: string, unitId?: string | null) {
    const res = await api.post('/surveys/draft/release-lock', {
      parcelId,
      unitId: unitId || undefined,
    });
    return res.data?.data || res.data;
  },

  /**
   * KSV ca sau nhập mã 6 số để tiếp quản ca khảo sát
   */
  async takeoverDraft(payload: TakeoverDraftPayload) {
    const res = await api.post('/surveys/draft/takeover', payload);
    return res.data?.data || res.data;
  },
};
