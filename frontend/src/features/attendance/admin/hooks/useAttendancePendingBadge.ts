import { useEffect, useState } from 'react';
import { getAttendanceCounters } from '../../api/attendance.api';

const REFRESH_MS = 120_000;

/** Số ca chờ hậu kiểm cho badge sidebar — gọi endpoint counters (nhẹ), làm mới mỗi 2 phút. */
export function useAttendancePendingBadge(zoneId: string | undefined, enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let alive = true;
    const scope = zoneId && zoneId !== 'ALL' ? zoneId : undefined;
    const tick = async () => {
      try {
        const c = await getAttendanceCounters(scope);
        if (alive) setCount(c.pendingTotal);
      } catch (err: unknown) {
        console.error('[AttendancePendingBadge] Không tải được số ca chờ duyệt:', err);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [zoneId, enabled]);

  return count;
}
