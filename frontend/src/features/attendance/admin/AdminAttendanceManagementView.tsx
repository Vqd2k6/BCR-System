import React, { useState } from 'react';
import { ClipboardCheck, CalendarRange } from 'lucide-react';
import { METRO_22_ZONES } from '@/features/survey-phase1/constants/metroGisConstants';
import { useAdminAttendanceAudit } from './hooks/useAdminAttendanceAudit';
import { AttendanceDailyKpiCards } from './components/AttendanceDailyKpiCards';
import { AttendanceFilterToolbar } from './components/AttendanceFilterToolbar';
import { AttendanceAuditTable } from './components/AttendanceAuditTable';
import { AttendanceVerifyDetailModal } from './components/AttendanceVerifyDetailModal';
import { AttendanceMonthlySummaryTab } from './components/AttendanceMonthlySummaryTab';
import { BATCH_SKIP_LABEL } from './components/AttendanceBadges';
import type { BatchSkipReason } from '../types/admin.types';

interface Props {
  /** Zone đang xem: từ sidebar Zone Admin; Super Admin chọn trong màn hình (mặc định toàn tuyến). */
  zoneId?: string;
  /** Super Admin: hiện bộ chọn Zone ngay trong màn hình. */
  allowZonePicker?: boolean;
  isSuperAdmin: boolean;
}

type Tab = 'audit' | 'monthly';

/** Màn Quản Lý Chấm Công cho Zone Admin & Super Admin: hậu kiểm ca, duyệt nhanh, bảng công tháng, chốt kỳ. */
export const AdminAttendanceManagementView: React.FC<Props> = ({ zoneId, allowZonePicker = false, isSuperAdmin }) => {
  const [tab, setTab] = useState<Tab>('audit');
  const [pickedZone, setPickedZone] = useState<string>('ALL');
  const effectiveZone = allowZonePicker ? pickedZone : zoneId;
  const audit = useAdminAttendanceAudit(effectiveZone);
  const [openId, setOpenId] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const onPickKpi = (k: 'pending' | 'anomaly' | 'missing' | 'today') => {
    if (k === 'today') audit.updateFilters({ preset: 'today', status: '', anomaly: '' });
    if (k === 'pending') audit.updateFilters({ preset: 'month', status: 'PENDING_VERIFICATION', anomaly: '' });
    if (k === 'anomaly') audit.updateFilters({ preset: 'month', status: 'PENDING_VERIFICATION', anomaly: 'ANY' });
    if (k === 'missing') audit.updateFilters({ preset: 'month', status: 'PENDING_VERIFICATION', anomaly: 'MISSING_CHECKOUT' });
  };

  const onQuickApprove = async () => {
    setBatchMessage(null);
    await audit.previewBatch();
  };

  const onConfirmBatch = async () => {
    const result = await audit.confirmBatch();
    if (result) setBatchMessage(`Đã duyệt ${result.approvedIds.length} ca hợp lệ.`);
  };

  const skippedEntries = audit.batchPreview
    ? (Object.entries(audit.batchPreview.skipped) as Array<[BatchSkipReason, number]>).filter(([, n]) => n > 0)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200">
          {([
            { key: 'audit', label: 'Hậu kiểm ca làm việc', icon: <ClipboardCheck size={14} /> },
            { key: 'monthly', label: 'Bảng tổng hợp công tháng', icon: <CalendarRange size={14} /> },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {allowZonePicker && (
          <select
            value={pickedZone}
            onChange={(e) => setPickedZone(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="ALL">Toàn tuyến (mọi Zone)</option>
            {METRO_22_ZONES.map((z) => (
              <option key={z.code} value={z.code}>
                {z.code} · {z.shortName}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === 'audit' ? (
        <>
          <AttendanceDailyKpiCards counters={audit.counters} onPick={onPickKpi} />
          <AttendanceFilterToolbar
            filters={audit.filters}
            onChange={audit.updateFilters}
            onRefresh={() => void audit.reload()}
            onQuickApprove={() => void onQuickApprove()}
            isLoading={audit.isLoading}
            isBatchRunning={audit.isBatchRunning}
          />

          {audit.batchPreview && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
              <p className="text-emerald-900">
                Server sẽ duyệt <strong>{audit.batchPreview.eligibleCount}</strong> ca sạch hoàn toàn (đủ vào/ra, không cảnh báo, có selfie) trong{' '}
                {audit.range.fromDate === audit.range.toDate ? `ngày ${audit.range.fromDate}` : `${audit.range.fromDate} → ${audit.range.toDate}`}.
              </p>
              {skippedEntries.length > 0 && (
                <p className="text-slate-600">
                  Bỏ qua: {skippedEntries.map(([k, n]) => `${BATCH_SKIP_LABEL[k]} (${n})`).join(' · ')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={audit.isBatchRunning || audit.batchPreview.eligibleCount === 0}
                  onClick={() => void onConfirmBatch()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Xác nhận duyệt {audit.batchPreview.eligibleCount} ca
                </button>
                <button
                  type="button"
                  onClick={() => audit.setBatchPreview(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
          {batchMessage && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{batchMessage}</div>}
          {audit.error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{audit.error}</div>}

          <AttendanceAuditTable
            items={audit.items}
            total={audit.total}
            page={audit.page}
            pageSize={audit.pageSize}
            isLoading={audit.isLoading}
            onPageChange={audit.setPage}
            onOpen={(it) => setOpenId(it.id)}
          />
        </>
      ) : (
        <AttendanceMonthlySummaryTab zoneId={effectiveZone} isSuperAdmin={isSuperAdmin} />
      )}

      {openId && (
        <AttendanceVerifyDetailModal
          checkInId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void audit.reload()}
        />
      )}
    </div>
  );
};
