import { useCallback, useEffect, useState } from 'react';
import { progressReportApi } from '../api/progressReport.api';
import type { ProgressConfigResponse, ProgressReportConfig } from '../types';
import { getErrorMessage } from '../../../utils/errorUtils';

export function useProgressConfig() {
  const [data, setData] = useState<ProgressConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await progressReportApi.getConfig());
    } catch (err: unknown) {
      console.error('[ProgressReport] Lỗi tải cấu hình:', err);
      setError(getErrorMessage(err, 'Không tải được cấu hình báo cáo tiến độ'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (content: ProgressReportConfig, changeReason: string): Promise<number | null> => {
      setIsSaving(true);
      setError(null);
      try {
        const version = await progressReportApi.saveConfig(content, changeReason);
        await load();
        return version;
      } catch (err: unknown) {
        console.error('[ProgressReport] Lỗi lưu cấu hình:', err);
        setError(getErrorMessage(err, 'Không lưu được cấu hình'));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, isSaving, error, reload: load, save };
}
