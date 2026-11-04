import React, { useCallback, useEffect, useState } from 'react';
import { Download, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  downloadMonthlySummaryCsv,
  getMonthlySummary,
  getPeriodStatus,
  lockAttendancePeriod,
  unlockAttendancePeriod,
} from '../../api/attendance.api';
import type { MonthlySummary, PeriodStatus } from '../../types/admin.types';
import { formatVnDateTime, vnMonth } from './AttendanceBadges';

interface Props {
  zoneId: string | undefined;
  isSuperAdmin: boolean;
}

const prevMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Bảng công tháng theo KSV + xuất CSV (server dựng) + chốt / mở khóa kỳ công (SHA-256). */
export const AttendanceMonthlySummaryTab: React.FC<Props> = ({ zoneId, isSuperAdmin }) => {
  const [month, setMonth] = useState(vnMonth());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [period, setPeriod] = useState<PeriodStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const isSpecificZone = Boolean(zoneId && zoneId !== 'ALL');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, p] = await Promise.all([
        getMonthlySummary(isSpecificZone ? zoneId : undefined, month),
        isSpecificZone ? getPeriodStatus(zoneId, month) : Promise.resolve(null),
      ]);
      setSummary(s);
      setPeriod(p);
    } catch (err: unknown) {
      console.error('[AttendanceMonthlySummaryTab:load] Không tải được bảng công tháng:', err);
      setError(getErrorMessage(err, 'Không tải được bảng công tháng.'));
    }
  }, [zoneId, month, isSpecificZone]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, fn: () => Promise<string | null>) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await load();
    } catch (err: unknown) {
      console.error(`[AttendanceMonthlySummaryTab:${label}] Thao tác thất bại:`, err);
      setError(getErrorMessage(err, 'Thao tác thất bại.'));
    } finally {
      setIsBusy(false);
    }
  };

  const onExport = () =>
    run('export', async () => {
      await downloadMonthlySummaryCsv(isSpecificZone ? zoneId : undefined, month);
      return null;
    });

  const onLock = () => {
    if (!window.confirm(`Chốt kỳ công tháng ${month} cho ${zoneId}? Sau khi chốt, mọi ca trong kỳ bị khóa thay đổi.`)) return;
    void run('lock', async () => {
      const r = await lockAttendancePeriod(zoneId, month);
      return `Đã chốt kỳ công. SHA-256: ${r.sha256}`;
    });
  };

  const onUnlock = () =>
    run('unlock', async () => {
      await unlockAttendancePeriod(zoneId, month, unlockReason.trim());
      setUnlockReason('');
      return 'Đã mở khóa kỳ công. Bản chốt cũ vẫn được lưu trong lịch sử.';
    });

  const rows = summary?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-slate-600">Kỳ công</label>
        <input
          type="month"
          value={month}
          max={vnMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="px-2 py-1.5 rounded-xl border border-slate-200 text-xs"
        />
        <button
          type="button"
          onClick={() => setMonth(prevMonth(vnMonth()))}
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          Tháng trước
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={13} /> Xuất Bảng Chấm Công (CSV)
        </button>
      </div>

      {isSpecificZone && period && (
        <div
          className={`p-3 rounded-2xl border text-xs space-y-2 ${
            period.status === 'LOCKED' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {period.status === 'LOCKED' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold bg-emerald-950 text-emerald-300 border-emerald-700">
                <ShieldCheck size={12} /> Kỳ đã chốt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold bg-slate-800 text-slate-200 border-slate-600">
                Kỳ đang mở
              </span>
            )}
            {period.status === 'LOCKED' && (
              <span className="text-slate-600">
                Chốt lúc {formatVnDateTime(period.lockedAt)} bởi {period.lockedByName || '---'}
              </span>
            )}
            <div className="flex-1" />
            {period.status === 'OPEN' && (
              <button
                type="button"
                onClick={onLock}
                disabled={isBusy || !period.canLock}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock size={13} /> Chốt kỳ công
              </button>
            )}
          </div>
          {period.status === 'OPEN' && !period.lockableMonth && (
            <p className="text-slate-500">Chỉ chốt được kỳ công của tháng đã kết thúc.</p>
          )}
          {period.status === 'OPEN' && period.lockableMonth && period.pendingCount > 0 && (
            <p className="text-amber-700">Còn {period.pendingCount} ca chờ duyệt trong kỳ (gồm cả lượt đi kèm và ca thiếu Check-out). Xử lý hết trước khi chốt.</p>
          )}
          {period.status === 'LOCKED' && isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Lý do mở khóa kỳ (bắt buộc)…"
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
              />
              <button
                type="button"
                onClick={() => void onUnlock()}
                disabled={isBusy || unlockReason.trim().length < 5}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Unlock size={13} /> Mở khóa kỳ
              </button>
            </div>
          )}
          {period.snapshots.length > 0 && (
            <details className="text-slate-600">
              <summary className="cursor-pointer font-bold">Lịch sử chốt kỳ ({period.snapshots.length})</summary>
              <ul className="mt-1 space-y-1">
                {period.snapshots.map((s) => (
                  <li key={s.id} className="font-mono text-[11px] break-all">
                    {formatVnDateTime(s.lockedAt)} · {s.lockedByName || '---'} · {s.sha256}
                    {s.unlockedAt && <span className="font-sans"> — mở khóa {formatVnDateTime(s.unlockedAt)}: “{s.unlockReason}”</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {!isSpecificZone && (
        <p className="text-xs text-slate-500">Đang xem toàn tuyến. Chọn một phân khu cụ thể để chốt kỳ công.</p>
      )}

      {notice && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 break-all">{notice}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}

      <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left font-bold">KSV</th>
              <th className="px-3 py-2 text-right font-bold">Ngày công</th>
              <th className="px-3 py-2 text-right font-bold">Duyệt / Nhắc / Từ chối / Chờ</th>
              <th className="px-3 py-2 text-right font-bold">Giờ thực địa</th>
              <th className="px-3 py-2 text-right font-bold">Thiếu Check-out</th>
              <th className="px-3 py-2 text-left font-bold">Người đi kèm (đã duyệt / tổng)</th>
              <th className="px-3 py-2 text-right font-bold">Hồ sơ đã nộp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  {summary ? 'Chưa có ca chấm công nào trong kỳ.' : 'Đang tải bảng công…'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.surveyorId}>
                <td className="px-3 py-2">
                  <div className="font-bold text-slate-800">{r.surveyorName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{r.surveyorCode || '---'}</div>
                </td>
                <td className="px-3 py-2 text-right font-black text-slate-900">{r.workDays}</td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {r.approvedDays} / {r.flaggedDays} / {r.rejectedDays} / {r.pendingDays}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{(r.totalWorkMinutes / 60).toFixed(1)}h</td>
                <td className="px-3 py-2 text-right text-slate-700">{r.missingCheckoutDays}</td>
                <td className="px-3 py-2 text-slate-600">
                  <div>
                    {r.companionAcceptedCount} / {r.companionCheckinsTotal}
                  </div>
                  {r.companions.length > 0 && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[260px]" title={r.companions.map((c) => [c.name, c.phone].filter(Boolean).join(' - ')).join('; ')}>
                      {r.companions.map((c) => c.name || c.phone).join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{r.surveysSubmitted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
