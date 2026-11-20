import { useEffect, useRef } from 'react';
import {
  getDraftOwnedByOther,
  surveyDraftService,
  type DraftOwnedByOtherInfo,
} from '../../features/survey-phase1/services/surveyDraftService';

/** 5 phút/lượt: dưới hạn khóa 15 phút của server, chừa 2 lượt mất mạng */
export const DRAFT_LOCK_HEARTBEAT_MS = 5 * 60 * 1000;

interface UseDraftLockHeartbeatOptions {
  parcelId: string | null | undefined;
  unitId?: string | null;
  /** Chỉ bật khi máy này đang giữ ca và được ghi: đã nạp nháp, không chỉ đọc, chưa nộp, không bị khóa */
  enabled: boolean;
  /** Server báo ca đã thuộc về KSV khác: nơi gọi dừng tự lưu và hiện màn khóa ca */
  onOwnershipLost: (info: DraftOwnedByOtherInfo) => void;
}

/**
 * Giữ khóa ca khảo sát khi form đang mở mà KSV chưa sửa gì (đo đạc, trao đổi với chủ hộ).
 * - Gửi 1 lượt khi bật, rồi 5 phút/lượt, chỉ khi màn hình đang hiện (máy khóa màn hình / chuyển app thì ngừng).
 * - Quay lại app sau khi ẩn ≥ 5 phút: gửi ngay để biết sớm nếu đã bị tiếp quản.
 * - Lỗi mạng: ghi log, lượt sau thử lại; không đổi nội dung nháp.
 */
export function useDraftLockHeartbeat({ parcelId, unitId, enabled, onOwnershipLost }: UseDraftLockHeartbeatOptions): void {
  const onLostRef = useRef(onOwnershipLost);
  useEffect(() => {
    onLostRef.current = onOwnershipLost;
  }, [onOwnershipLost]);

  useEffect(() => {
    if (!enabled || !parcelId) return;

    let stopped = false;
    let inFlight = false;
    let lastBeatAt = 0;

    const beat = async () => {
      if (stopped || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      lastBeatAt = Date.now();
      try {
        await surveyDraftService.heartbeatLock(parcelId, unitId);
      } catch (err: unknown) {
        const owned = getDraftOwnedByOther(err);
        if (owned) {
          stopped = true;
          console.error('[useDraftLockHeartbeat:OwnershipLost] Ca khảo sát đã thuộc về KSV khác:', owned.activeSurveyorName, err);
          onLostRef.current(owned);
        } else {
          console.error('[useDraftLockHeartbeat:Beat] Không gửi được nhịp giữ khóa ca, lượt sau thử lại:', err);
        }
      } finally {
        inFlight = false;
      }
    };

    void beat();
    const timer = setInterval(() => {
      void beat();
    }, DRAFT_LOCK_HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastBeatAt >= DRAFT_LOCK_HEARTBEAT_MS) {
        void beat();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, parcelId, unitId]);
}
