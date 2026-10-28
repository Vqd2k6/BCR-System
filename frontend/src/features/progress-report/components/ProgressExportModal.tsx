import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, FileSpreadsheet, Layers, RefreshCw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProgressPreview, validateQuery } from '../hooks/useProgressPreview';
import { progressReportApi } from '../api/progressReport.api';
import type { ProgressQueryParams, ProgressSummaryRow, ProgressTimeMode } from '../types';
import { getErrorMessage } from '../../../utils/errorUtils';
import { METRO_22_ZONES, type MetroZoneConfig } from '../../survey-phase1/constants/metroGisConstants';

interface ProgressExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialZoneId: string;
  /** Khóa chọn phân khu (Zone Admin chỉ xuất zone đang làm việc). */
  lockZone?: boolean;
}

const TIME_MODES: Array<{ key: ProgressTimeMode; label: string; hint: string }> = [
  { key: 'TODAY', label: 'Riêng hôm nay', hint: 'Công trình có hoạt động khảo sát / nộp / ghi nhận vắng mặt trong ngày hôm nay' },
  { key: 'DATE_RANGE', label: 'Từ ngày X đến ngày Y', hint: 'Công trình có hoạt động trong khoảng ngày đã chọn' },
  { key: 'ALL_TIME', label: 'Tình trạng hiện tại (lũy kế)', hint: 'Toàn bộ hiện trạng từ trước đến nay' },
];

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function pct(count: number, needed: number): string {
  return needed > 0 ? `${((count / needed) * 100).toFixed(1)}%` : '-';
}

const SummaryRowView: React.FC<{ row: ProgressSummaryRow; isTotal?: boolean }> = ({ row, isTotal = false }) => (
  <tr className={isTotal ? 'bg-amber-100 font-bold text-slate-900' : 'text-slate-700'}>
    <td className="px-2.5 py-2 border border-slate-200 whitespace-nowrap">{row.label}</td>
    <td className="px-2.5 py-2 border border-slate-200 text-center">{row.needed}</td>
    <td className="px-2.5 py-2 border border-slate-200 text-center">
      {row.surveyed} <span className="text-[10px] text-slate-500">({pct(row.surveyed, row.needed)})</span>
    </td>
    <td className="px-2.5 py-2 border border-slate-200 text-center bg-fuchsia-50">
      {row.inaccessible} <span className="text-[10px] text-slate-500">({pct(row.inaccessible, row.needed)})</span>
    </td>
    <td className="px-2.5 py-2 border border-slate-200 text-center">
      {row.withFoundation} <span className="text-[10px] text-slate-500">({pct(row.withFoundation, row.needed)})</span>
    </td>
    <td className="px-2.5 py-2 border border-slate-200 text-center bg-yellow-50">
      {row.monitor} <span className="text-[10px] text-slate-500">({pct(row.monitor, row.needed)})</span>
    </td>
    <td className="px-2.5 py-2 border border-slate-200 text-center bg-rose-50">
      {row.highRisk} <span className="text-[10px] text-slate-500">({pct(row.highRisk, row.needed)})</span>
    </td>
  </tr>
);

export const ProgressExportModal: React.FC<ProgressExportModalProps> = ({ isOpen, onClose, initialZoneId, lockZone = false }) => {
  const [zoneId, setZoneId] = useState(initialZoneId || 'ALL');
  const [timeMode, setTimeMode] = useState<ProgressTimeMode>('TODAY');
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setZoneId(initialZoneId || 'ALL');
      setFeedback(null);
    }
  }, [isOpen, initialZoneId]);

  const query: ProgressQueryParams = useMemo(
    () => ({ zoneId, timeMode, fromDate, toDate }),
    [zoneId, timeMode, fromDate, toDate]
  );
  const { data, isLoading, error, reload } = useProgressPreview(query, isOpen);
  const validationError = validateQuery(query);

  const handleDownload = async () => {
    if (validationError) return;
    setIsDownloading(true);
    setFeedback(null);
    try {
      const filename = await progressReportApi.downloadExcel(query);
      setFeedback({ type: 'success', text: `Đã tải xuống: ${filename}` });
    } catch (err: unknown) {
      console.error('[ProgressReport] Lỗi tải file Excel tiến độ:', err);
      setFeedback({ type: 'error', text: getErrorMessage(err, 'Không xuất được file Excel') });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Xuất File Tiến Độ Khảo Sát (.xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo mẫu báo cáo tiến độ ngày: 28 cột, chú giải tình trạng, bảng tổng hợp Phải/Trái tuyến.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all active:scale-95 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Bộ lọc */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Phân khu / Nhà ga
              </label>
              {lockZone ? (
                <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold font-mono text-slate-700">
                  {zoneId === 'ALL' ? 'Toàn tuyến' : zoneId}
                </div>
              ) : (
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Toàn tuyến (tất cả phân khu)</option>
                  {METRO_22_ZONES.map((z: MetroZoneConfig) => (
                    <option key={z.code} value={z.code}>
                      {z.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Kỳ báo cáo
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    title={m.hint}
                    onClick={() => setTimeMode(m.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                      timeMode === m.key
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {timeMode === 'DATE_RANGE' && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Từ ngày</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-500">đến ngày</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Xem trước tổng hợp */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-800 truncate">{data?.title || 'Xem trước bảng tổng hợp'}</div>
                <div className="text-[11px] text-slate-500">
                  {data ? `${data.periodLabel} • ${data.totalRows} dòng chi tiết` : 'Chọn bộ lọc để xem trước'}
                  {data && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">
                      cấu hình {data.configVersion ? `v${data.configVersion}` : 'mặc định'}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={isLoading}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Tải lại
              </button>
            </div>

            {error || validationError ? (
              <div className="p-4 text-xs text-rose-700 bg-rose-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {validationError || error}
              </div>
            ) : isLoading && !data ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> Đang tổng hợp dữ liệu tiến độ...
              </div>
            ) : data ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-sky-100 text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 border border-slate-200 text-left">Khu vực KS</th>
                      <th className="px-2.5 py-2 border border-slate-200">Cần KS</th>
                      <th className="px-2.5 py-2 border border-slate-200">Khảo sát được</th>
                      <th className="px-2.5 py-2 border border-slate-200">Không tiếp cận</th>
                      <th className="px-2.5 py-2 border border-slate-200">Có TT móng &amp; KC</th>
                      <th className="px-2.5 py-2 border border-slate-200">Cần theo dõi</th>
                      <th className="px-2.5 py-2 border border-slate-200">Nguy cơ cao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.groups.map((g) => (
                      <SummaryRowView key={g.label} row={g} />
                    ))}
                    <SummaryRowView row={data.summary.total} isTotal />
                  </tbody>
                </table>
                {data.totalRows === 0 && (
                  <div className="p-3 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200">
                    Không có công trình nào phát sinh hoạt động trong kỳ đã chọn. File vẫn xuất được kèm bảng tổng hợp.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {feedback.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={isDownloading || Boolean(validationError)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isDownloading ? 'Đang tạo file...' : 'Tải File Tiến Độ (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};
