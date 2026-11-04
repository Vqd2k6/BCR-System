import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  batchVerifyClean,
  getAttendanceCounters,
  listAdminCheckIns,
} from '../../api/attendance.api';
import type {
  AdminCheckIn,
  AttendanceAnomalyFilter,
  AttendanceCounters,
  AttendanceVerificationStatus,
  BatchVerifyResult,
} from '../../types/admin.types';
import { vnDate } from '../components/AttendanceBadges';

export type DatePreset = 'today' | 'yesterday' | '7d' | 'month' | 'custom';
export type PersonFilter = 'all' | 'main' | 'companion';

export interface AttendanceFilterState {
  preset: DatePreset;
  fromDate: string;
  toDate: string;
  person: PersonFilter;
  status: AttendanceVerificationStatus | '';
  anomaly: AttendanceAnomalyFilter | '';
  search: string;
}

const PAGE_SIZE = 50;

export function rangeForPreset(preset: DatePreset, custom: { fromDate: string; toDate: string }) {
  const today = vnDate(0);
  switch (preset) {
    case 'today':
      return { fromDate: today, toDate: today };
    case 'yesterday':
      return { fromDate: vnDate(-1), toDate: vnDate(-1) };
    case '7d':
      return { fromDate: vnDate(-6), toDate: today };
    case 'month':
      return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
    default:
      return custom;
  }
}

/** Danh sách hậu kiểm + KPI + duyệt nhanh theo bộ lọc hiện tại. Phạm vi Zone do server quyết định theo tài khoản. */
export function useAdminAttendanceAudit(zoneId: string | undefined) {
  const [filters, setFilters] = useState<AttendanceFilterState>(() => ({
    preset: 'today',
    fromDate: vnDate(0),
    toDate: vnDate(0),
    person: 'all',
    status: '',
    anomaly: '',
    search: '',
  }));
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AdminCheckIn[]>([]);
  const [total, setTotal] = useState(0);
  const [counters, setCounters] = useState<AttendanceCounters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchVerifyResult | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filters.search]);

  const range = useMemo(
    () => rangeForPreset(filters.preset, { fromDate: filters.fromDate, toDate: filters.toDate }),
    [filters.preset, filters.fromDate, filters.toDate]
  );
  const isCompanion = filters.person === 'all' ? undefined : filters.person === 'companion';
  const scopeZone = zoneId && zoneId !== 'ALL' ? zoneId : undefined;

  // Đổi Zone (sidebar) thì quay về trang đầu
  useEffect(() => {
    setPage(0);
  }, [scopeZone]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pageRes, counterRes] = await Promise.all([
        listAdminCheckIns({
          zoneId: scopeZone,
          fromDate: range.fromDate,
          toDate: range.toDate,
          isCompanion,
          status: filters.status || undefined,
          anomaly: filters.anomaly || undefined,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        getAttendanceCounters(scopeZone),
      ]);
      setItems(pageRes.items);
      setTotal(pageRes.total);
      setCounters(counterRes);
    } catch (err: unknown) {
      console.error('[AdminAttendance:reload] Không tải được danh sách chấm công:', err);
      setError(getErrorMessage(err, 'Không tải được danh sách chấm công.'));
    } finally {
      setIsLoading(false);
    }
  }, [scopeZone, range.fromDate, range.toDate, isCompanion, filters.status, filters.anomaly, debouncedSearch, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateFilters = useCallback((patch: Partial<AttendanceFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(0);
  }, []);

  const batchBody = useCallback(
    (dryRun: boolean) => ({
      zoneId: scopeZone,
      fromDate: range.fromDate,
      toDate: range.toDate,
      isCompanion,
      search: debouncedSearch || undefined,
      dryRun,
    }),
    [scopeZone, range.fromDate, range.toDate, isCompanion, debouncedSearch]
  );

  /** Bước 1: hỏi server sẽ duyệt bao nhiêu ca (không ghi gì). */
  const previewBatch = useCallback(async () => {
    setIsBatchRunning(true);
    setError(null);
    try {
      setBatchPreview(await batchVerifyClean(batchBody(true)));
    } catch (err: unknown) {
      console.error('[AdminAttendance:previewBatch] Không kiểm tra được danh sách duyệt nhanh:', err);
      setError(getErrorMessage(err, 'Không kiểm tra được danh sách duyệt nhanh.'));
    } finally {
      setIsBatchRunning(false);
    }
  }, [batchBody]);

  /** Bước 2: duyệt thật; server tự chọn lại ca sạch (không tin danh sách client). */
  const confirmBatch = useCallback(async (): Promise<BatchVerifyResult | null> => {
    setIsBatchRunning(true);
    setError(null);
    try {
      const result = await batchVerifyClean(batchBody(false));
      setBatchPreview(null);
      await reload();
      return result;
    } catch (err: unknown) {
      console.error('[AdminAttendance:confirmBatch] Duyệt nhanh thất bại:', err);
      setError(getErrorMessage(err, 'Duyệt nhanh thất bại, chưa ca nào được duyệt.'));
      return null;
    } finally {
      setIsBatchRunning(false);
    }
  }, [batchBody, reload]);

  return {
    filters,
    updateFilters,
    range,
    items,
    total,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    counters,
    isLoading,
    error,
    reload,
    batchPreview,
    setBatchPreview,
    isBatchRunning,
    previewBatch,
    confirmBatch,
  };
}
