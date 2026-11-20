import { getErrorMessage, getErrorResponseData, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { api } from '../../../services/api';
import type { Phase1SurveyFormData } from '../types/phase1.types';
import type { LockedInfo } from '../components/ActiveSurveyorLockedModal';

export interface OrphanPhotoRecoveryResult {
  status: 'DONE' | 'UNAVAILABLE' | 'NO_DRAFT' | 'NOTHING_TO_RECOVER';
  recovered: Record<string, string>;
  unresolved: { localId: string; reason: string; candidates: string[] }[];
}

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
  isViewOnly?: boolean;
  photoMappings?: Record<string, string>;
  unsyncedPhotosInfo?: {
    pendingCount: number;
    ownerSurveyorName: string;
    ownerSurveyorPhone: string;
  };
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

/** Người đang giữ ca khi server trả 409 DRAFT_OWNED_BY_OTHER (máy này đã mất quyền ghi nháp) */
export interface DraftOwnedByOtherInfo {
  activeSurveyorName: string;
  activeSurveyorPhone: string;
  lastActiveAt: string | null;
  minutesAgo: number;
  message: string;
}

/** Nhận diện lỗi "ca khảo sát thuộc về KSV khác" từ lượt lưu nháp / nhịp giữ khóa; lỗi khác trả null */
export function getDraftOwnedByOther(err: unknown): DraftOwnedByOtherInfo | null {
  if (getErrorStatus(err) !== 409) return null;
  const data = getErrorResponseData<{ code?: string; detail?: string; meta?: Record<string, unknown> }>(err);
  if (data?.code !== 'DRAFT_OWNED_BY_OTHER') return null;
  const meta = data.meta || {};
  return {
    activeSurveyorName: typeof meta.activeSurveyorName === 'string' ? meta.activeSurveyorName : 'Kỹ sư khác',
    activeSurveyorPhone: typeof meta.activeSurveyorPhone === 'string' ? meta.activeSurveyorPhone : '',
    lastActiveAt: typeof meta.lastActiveAt === 'string' ? meta.lastActiveAt : null,
    minutesAgo: typeof meta.minutesAgo === 'number' ? meta.minutesAgo : 0,
    message: getErrorMessage(err),
  };
}

/** Thông tin hiển thị ở ActiveSurveyorLockedModal khi máy này vừa mất ca */
export function toLostOwnershipLockedInfo(info: DraftOwnedByOtherInfo): LockedInfo {
  return {
    surveyorName: info.activeSurveyorName,
    phone: info.activeSurveyorPhone || undefined,
    minutesAgo: Math.max(1, info.minutesAgo),
    message: info.message,
    lostOwnership: true,
    lastActiveAt: info.lastActiveAt,
  };
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
  async fetchDraft(
    parcelId: string,
    unitId?: string | null,
    options?: { viewOnly?: boolean }
  ): Promise<DraftResponseData> {
    try {
      const res = await api.get(`/surveys/draft/${parcelId}`, {
        params: {
          ...(unitId ? { unitId } : {}),
          ...(options?.viewOnly ? { viewOnly: 'true' } : {}),
        },
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
   * Nhịp giữ khóa ca khi form đang mở mà KSV chưa sửa gì (không đổi nội dung nháp).
   * Lỗi 409 DRAFT_OWNED_BY_OTHER được ném ra để nơi gọi dừng tự lưu.
   */
  async heartbeatLock(parcelId: string, unitId?: string | null): Promise<{ held: boolean; status: 'HELD' | 'NO_DRAFT' }> {
    const res = await api.post('/surveys/draft/heartbeat', {
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

  /**
   * Nhờ server tìm trên kho lưu trữ các ảnh mà bản nháp chỉ còn blob:local://
   */
  async recoverOrphanPhotos(parcelId: string, unitId?: string | null): Promise<OrphanPhotoRecoveryResult> {
    const res = await api.post(`/surveys/draft/${parcelId}/recover-orphan-photos`, {
      unitId: unitId || undefined,
    });
    return res.data?.data || res.data;
  },

  /**
   * Lưu ánh xạ ảnh (localId -> Cloudflare R2 URL) lên Server Draft để bảo vệ liên thiết bị
   */
  async savePhotoMappings(
    parcelId: string,
    unitId: string | null | undefined,
    mappings: Record<string, string>,
    deviceId?: string
  ) {
    if (!parcelId || !mappings || Object.keys(mappings).length === 0) return;
    try {
      const res = await api.post(`/surveys/draft/${parcelId}/photo-mappings`, {
        unitId: unitId || undefined,
        mappings,
        deviceId,
      });
      return res.data?.data || res.data;
    } catch (err) {
      console.warn('[surveyDraftService] Lỗi lưu photo mappings lên server:', err);
    }
  },
};
