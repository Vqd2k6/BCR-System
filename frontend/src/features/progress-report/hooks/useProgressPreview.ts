import { useCallback, useEffect, useRef, useState } from 'react';
import { progressReportApi } from '../api/progressReport.api';
import type { ProgressPreviewData, ProgressQueryParams } from '../types';
import { getErrorMessage } from '../../../utils/errorUtils';

/** Kiểm tra bộ lọc đủ điều kiện gọi API (DATE_RANGE cần đủ 2 ngày và hợp lệ). */
export function validateQuery(q: ProgressQueryParams): string | null {
  if (!q.zoneId) return 'Vui lòng chọn phân khu';
  if (q.timeMode === 'DATE_RANGE') {
    if (!q.fromDate || !q.toDate) return 'Vui lòng chọn đủ "Từ ngày" và "Đến ngày"';
    if (q.fromDate > q.toDate) return '"Đến ngày" phải lớn hơn hoặc bằng "Từ ngày"';
  }
  return null;
}

export function useProgressPreview(query: ProgressQueryParams, enabled: boolean) {
  const [data, setData] = useState<ProgressPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const invalid = validateQuery(query);
    if (invalid) {
      setError(invalid);
      setData(null);
      return;
    }
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await progressReportApi.preview(query);
      if (seq === requestSeq.current) setData(result);
    } catch (err: unknown) {
      console.error('[ProgressReport] Lỗi tải xem trước tiến độ:', err);
      if (seq === requestSeq.current) {
        setError(getErrorMessage(err, 'Không tải được dữ liệu xem trước'));
        setData(null);
      }
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { data, isLoading, error, reload: load };
}
