import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, Eye, Loader2, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  METRO_22_ZONES,
  type MetroZoneConfig,
} from '../../../../survey-phase1/constants/metroGisConstants';
import { fetchMinutePdfBlob, fetchZoneMinutes, startZoneMinutesJob } from '../api/minutesExport.api';
import type { MinutesCategory, MinutesJobStatus, MinutesListItem } from '../types';
import { BatchMinutesExportProgressModal } from './modals/BatchMinutesExportProgressModal';

interface ZoneMinutesTabProps {
  zoneId: string;
  onZoneChange: (zoneId: string) => void;
  hideZoneSelect: boolean;
}

type MinutesFilter = 'ALL' | MinutesCategory;

const FILTERS: { value: MinutesFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'MINUTES', label: 'Có biên bản' },
  { value: 'ABSENTEE', label: 'Vắng chủ' },
  { value: 'NONE', label: 'Chưa có' },
];

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Đã nộp',
  UNDER_REVIEW: 'Đang thẩm định',
  APPROVED: 'Đã phê duyệt',
};

const LABEL_BADGE: Record<MinutesCategory, string> = {
  MINUTES: 'bg-emerald-950 text-emerald-300 border-emerald-700',
  ABSENTEE: 'bg-amber-950 text-amber-300 border-amber-700',
  NONE: 'bg-slate-800 text-slate-300 border-slate-600',
};

const isSingleZone = (zoneId: string): boolean => {
  const zone = zoneId.trim().toUpperCase();
  return Boolean(zone) && zone !== 'ALL' && zone !== 'ALL_ZONES';
};

export const ZoneMinutesTab: React.FC<ZoneMinutesTabProps> = ({ zoneId, onZoneChange, hideZoneSelect }) => {
  const [items, setItems] = useState<MinutesListItem[]>([]);
  const [job, setJob] = useState<MinutesJobStatus | null>(null);
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MinutesFilter>('ALL');
  const [page, setPage] = useState<number>(1);

  const zoneReady = isSingleZone(zoneId);

  const loadMinutes = useCallback(async () => {
    if (!zoneReady) {
      setItems([]);
      setJob(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const summary = await fetchZoneMinutes(zoneId);
      setItems(summary.items);
      setJob(summary.latestJob);
    } catch (err: unknown) {
      console.error('[MinutesExport:LoadList] Không tải được danh sách biên bản:', err);
      setItems([]);
      setError(getErrorMessage(err, 'Không tải được danh sách biên bản.'));
    } finally {
      setIsLoading(false);
    }
  }, [zoneId, zoneReady]);

  useEffect(() => {
    setPage(1);
    loadMinutes();
  }, [loadMinutes]);

  const counts = useMemo(() => {
    const result: Record<MinutesFilter, number> = { ALL: items.length, MINUTES: 0, ABSENTEE: 0, NONE: 0 };
    for (const item of items) result[item.category] += 1;
    return result;
  }, [items]);

  const filteredItems = useMemo(
    () => (filter === 'ALL' ? items : items.filter((item) => item.category === filter)),
    [items, filter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const exportableCount = counts.MINUTES;
  const jobRunning = job?.status === 'QUEUED' || job?.status === 'PROCESSING';

  const zipDisabledReason = !zoneReady
    ? 'Chọn một Zone cụ thể để xuất ZIP'
    : exportableCount === 0
      ? 'Zone này chưa có biên bản đủ điều kiện xuất'
      : null;

  const handleFetchPdf = async (item: MinutesListItem, mode: 'PREVIEW' | 'DOWNLOAD') => {
    if (!item.reportId) return;
    setBusyReportId(item.reportId);
    setError(null);
    try {
      const url = URL.createObjectURL(await fetchMinutePdfBlob(item.reportId));
      if (mode === 'PREVIEW') {
        window.open(url, '_blank', 'noopener');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = item.fileName ?? 'Bien_Ban.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: unknown) {
      console.error('[MinutesExport:SinglePdf] Không xuất được PDF:', err);
      setError(getErrorMessage(err, 'Không xuất được PDF biên bản.'));
    } finally {
      setBusyReportId(null);
    }
  };

  const handleStartJob = async () => {
    if (jobRunning) {
      setShowJobModal(true);
      return;
    }
    setIsStarting(true);
    setError(null);
    try {
      setJob(await startZoneMinutesJob(zoneId));
      setShowJobModal(true);
    } catch (err: unknown) {
      console.error('[MinutesExport:StartJob] Không tạo được job xuất ZIP:', err);
      setError(getErrorMessage(err, 'Không tạo được job xuất ZIP.'));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {!hideZoneSelect && (
            <select
              value={zoneId}
              onChange={(e) => onZoneChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {!zoneReady && <option value={zoneId}>Chọn Zone...</option>}
              {METRO_22_ZONES.map((zone: MetroZoneConfig) => (
                <option key={zone.code} value={zone.code}>
                  {zone.name}
                </option>
              ))}
            </select>
          )}
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                filter === value
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMinutes}
            disabled={isLoading || !zoneReady}
            className="rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Làm mới"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleStartJob}
            disabled={zipDisabledReason !== null || isStarting}
            title={zipDisabledReason ?? 'Xuất toàn bộ biên bản của Zone thành file ZIP'}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Archive size={14} />
            {jobRunning ? `Đang xuất ${job?.progressDone ?? 0}/${job?.progressTotal ?? 0}` : `Xuất ZIP (${exportableCount} hồ sơ)`}
          </button>
          {job && !jobRunning && (
            <button
              type="button"
              onClick={() => setShowJobModal(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Lần xuất gần nhất
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
      {!zoneReady && <p className="text-xs font-semibold text-slate-600">Chọn một Zone cụ thể để xem biên bản.</p>}

      {zoneReady && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-bold">Mã thửa / căn</th>
                <th className="px-4 py-2.5 font-bold">Trạng thái hồ sơ</th>
                <th className="px-4 py-2.5 font-bold">Biên bản</th>
                <th className="px-4 py-2.5 font-bold">Số trang</th>
                <th className="px-4 py-2.5 font-bold">Ghi chú</th>
                <th className="px-4 py-2.5 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const canExport = Boolean(item.reportId && item.fileName);
                const isBusy = busyReportId === item.reportId;
                return (
                  <tr key={item.key} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-2.5">
                      <span className="rounded border border-teal-700 bg-teal-950 px-1.5 py-0.5 font-mono font-bold text-teal-300">
                        {item.parcelCode}
                      </span>
                      {item.unitCode && (
                        <span className="ml-1.5 rounded border border-indigo-700 bg-indigo-950 px-1.5 py-0.5 font-mono font-bold text-indigo-300">
                          {item.unitCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{item.reportStatus ? STATUS_LABELS[item.reportStatus] ?? item.reportStatus : '---'}</td>
                    <td className="px-4 py-2.5">
                      {item.label ? (
                        <span className={`rounded border px-1.5 py-0.5 font-bold ${LABEL_BADGE[item.category]}`}>{item.label}</span>
                      ) : (
                        '---'
                      )}
                    </td>
                    <td className="px-4 py-2.5">{item.docPageCount > 0 ? item.docPageCount : '---'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{item.note ?? ''}</td>
                    <td className="px-4 py-2.5">
                      {canExport && (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleFetchPdf(item, 'PREVIEW')}
                            disabled={busyReportId !== null}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Xem trước"
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFetchPdf(item, 'DOWNLOAD')}
                            disabled={busyReportId !== null}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tải PDF"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Không có hồ sơ phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-2 py-1 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <span>
                {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-2 py-1 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      )}

      {showJobModal && job && (
        <BatchMinutesExportProgressModal job={job} onJobChange={setJob} onClose={() => setShowJobModal(false)} />
      )}
    </div>
  );
};
