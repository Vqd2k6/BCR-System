import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchResurveyTasks } from '../api/photoResurvey.api';
import type { ResurveyTask } from '../types';

/**
 * Danh sách hồ sơ nhà dân còn ảnh ngoài nhà cần chụp lại trong phân khu đang xem.
 * `enabled = false` (khách, nhà thầu) thì không gọi API.
 */
export function useResurveyTasks(zone: string | undefined, enabled: boolean) {
  const [tasks, setTasks] = useState<ResurveyTask[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      setTasks(await fetchResurveyTasks({ zone }));
    } catch (err: unknown) {
      console.error('[PhotoResurvey:tasks] Không tải được danh sách thửa cần khảo sát bổ sung', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [zone, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Một thửa có thể có nhiều hồ sơ: ưu tiên hồ sơ còn chờ chụp, sau đó hồ sơ chờ duyệt. */
  const byParcel = useMemo(() => {
    const m = new Map<string, ResurveyTask>();
    for (const t of tasks) {
      const cur = m.get(t.parcelId);
      if (!cur || (cur.state === 'SUBMITTED' && t.state === 'PENDING')) m.set(t.parcelId, t);
    }
    return m;
  }, [tasks]);

  return { tasks, byParcel, loading, reload };
}
