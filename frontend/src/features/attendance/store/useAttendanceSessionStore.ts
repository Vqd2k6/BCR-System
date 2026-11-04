import { useEffect } from 'react';
import { create } from 'zustand';
import { getErrorMessage } from '@/utils/errorUtils';
import { getVietnamDateString, resolveAttendancePhotoUrl } from '@/core/utils/metroZoneUtils';
import { fetchMyHistory } from '../api/attendance.api';
import type { AttendanceRecord } from '../types/attendance.types';

/**
 * Trạng thái ca hôm nay của người đang đăng nhập — nguồn duy nhất cho App, Navbar và màn hình trang chủ KSV.
 * Server là nguồn sự thật; store không lưu localStorage, gắn với userId + ngày VN và tự reset khi sang ngày mới.
 */

export const ATTENDANCE_UPDATED_EVENT = 'metro2-attendance-updated';

export interface TodayCheckInSummary {
  checkInId: string | null;
  time: string;
  distance: number | null;
  status: string;
  selfiePhotoUrl: string;
  hasCheckedOut: boolean;
}

interface AttendanceSessionState {
  userId: string | null;
  dateStr: string | null;
  today: TodayCheckInSummary | null;
  companionCountToday: number;
  isSyncing: boolean;
  lastError: string | null;
  sync: (userId: string) => Promise<void>;
  /** Cập nhật lạc quan ngay sau khi check-in thành công (lần sync kế tiếp sẽ ghi đè bằng dữ liệu server). */
  applyLocalCheckIn: (userId: string, details: { time: string; distance: number; status: string }) => void;
  reset: () => void;
}

const toSummary = (r: AttendanceRecord): TodayCheckInSummary => {
  const rawDistance = r.distance_to_zone_center_meters ?? r.distance_meters;
  return {
    checkInId: r.id ?? null,
    time: new Date(r.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    distance: rawDistance === undefined || rawDistance === null ? null : Math.round(Number(rawDistance)),
    status: r.verification_status || 'PENDING_VERIFICATION',
    selfiePhotoUrl: resolveAttendancePhotoUrl(r.selfie_photo_url),
    hasCheckedOut: Boolean(r.checkout_time),
  };
};

let syncSeq = 0;

export const useAttendanceSessionStore = create<AttendanceSessionState>((set, get) => ({
  userId: null,
  dateStr: null,
  today: null,
  companionCountToday: 0,
  isSyncing: false,
  lastError: null,

  sync: async (userId: string) => {
    const dateStr = getVietnamDateString();
    const seq = ++syncSeq;
    // Đổi người dùng hoặc sang ngày mới: xóa ngay trạng thái cũ, không để người sau thấy ca của người trước.
    if (get().userId !== userId || get().dateStr !== dateStr) {
      set({ userId, dateStr, today: null, companionCountToday: 0 });
    }
    set({ isSyncing: true, lastError: null });
    try {
      const records = await fetchMyHistory({ fromDate: dateStr, toDate: dateStr });
      if (seq !== syncSeq) return;
      const todayRecords = records.filter((r) => getVietnamDateString(r.checkin_time) === dateStr);
      const main = todayRecords.find((r) => !r.is_companion);
      set({
        userId,
        dateStr,
        today: main ? toSummary(main) : null,
        companionCountToday: todayRecords.filter((r) => Boolean(r.is_companion)).length,
        isSyncing: false,
      });
    } catch (err: unknown) {
      console.error('[AttendanceSessionStore:sync] Không đồng bộ được ca hôm nay:', err);
      if (seq !== syncSeq) return;
      set({ isSyncing: false, lastError: getErrorMessage(err, 'Không đồng bộ được trạng thái chấm công hôm nay.') });
    }
  },

  applyLocalCheckIn: (userId, details) => {
    set({
      userId,
      dateStr: getVietnamDateString(),
      today: {
        checkInId: null,
        time: details.time,
        distance: details.distance,
        status: details.status,
        selfiePhotoUrl: '',
        hasCheckedOut: false,
      },
    });
  },

  reset: () => {
    syncSeq += 1;
    set({ userId: null, dateStr: null, today: null, companionCountToday: 0, isSyncing: false, lastError: null });
  },
}));

/** Selector: trạng thái hôm nay chỉ hợp lệ khi đúng người + đúng ngày VN hiện tại. */
export function useTodayAttendance(userId: string | null | undefined) {
  return useAttendanceSessionStore((s) =>
    userId && s.userId === userId && s.dateStr === getVietnamDateString() ? s.today : null
  );
}

export function useTodayCompanionCount(userId: string | null | undefined) {
  return useAttendanceSessionStore((s) =>
    userId && s.userId === userId && s.dateStr === getVietnamDateString() ? s.companionCountToday : 0
  );
}

/**
 * Gắn 1 lần ở App: đồng bộ khi đăng nhập, khi có sự kiện chấm công, khi quay lại tab, và khi qua 0h (PWA mở qua đêm).
 */
export function useAttendanceSessionSync(userId: string | null | undefined, enabled: boolean) {
  useEffect(() => {
    const store = useAttendanceSessionStore.getState();
    if (!enabled || !userId) {
      store.reset();
      return;
    }
    void store.sync(userId);

    const resync = () => {
      void useAttendanceSessionStore.getState().sync(userId);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    const dayWatcher = window.setInterval(() => {
      if (useAttendanceSessionStore.getState().dateStr !== getVietnamDateString()) resync();
    }, 60_000);

    window.addEventListener(ATTENDANCE_UPDATED_EVENT, resync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(dayWatcher);
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, resync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, enabled]);
}

/**
 * Khóa cache localStorage của màn chấm công, gắn theo user + ngày VN để máy dùng chung không lộ ca của người trước.
 * Tiền tố `metro2_attendance_` được AuthContext dọn khi đăng xuất.
 */
export function attendanceCacheKey(kind: 'today' | 'companion' | 'companion_count', userId: string | null | undefined, dateStr: string): string {
  return `metro2_attendance_${kind}_${userId || 'anonymous'}_${dateStr}`;
}
