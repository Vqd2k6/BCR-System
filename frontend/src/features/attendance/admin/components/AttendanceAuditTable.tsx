import React from 'react';
import { ChevronLeft, ChevronRight, Lock, ImageOff } from 'lucide-react';
import type { AdminCheckIn } from '../../types/admin.types';
import {
  AnomalyBadge,
  DistanceBadge,
  RoleBadge,
  StatusBadge,
  ZoneBadge,
  formatDuration,
  formatVnTime,
} from './AttendanceBadges';

interface Props {
  items: AdminCheckIn[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onOpen: (item: AdminCheckIn) => void;
}

const Thumb: React.FC<{ url: string | null; alt: string }> = ({ url, alt }) =>
  url ? (
    <img src={url} alt={alt} loading="lazy" className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-slate-100" />
  ) : (
    <div className="w-10 h-10 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300" title={`${alt}: chưa có`}>
      <ImageOff size={14} />
    </div>
  );

/** Bảng hậu kiểm ca chấm công. Bấm dòng để mở modal soi chi tiết và duyệt. */
export const AttendanceAuditTable: React.FC<Props> = ({ items, total, page, pageSize, isLoading, onPageChange, onOpen }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Nhân sự</th>
              <th className="px-3 py-2 text-left font-bold">Zone</th>
              <th className="px-3 py-2 text-left font-bold">Vào → Ra</th>
              <th className="px-3 py-2 text-left font-bold">Cự ly tới tâm Zone</th>
              <th className="px-3 py-2 text-left font-bold">Selfie vào / ra</th>
              <th className="px-3 py-2 text-left font-bold">Sản lượng</th>
              <th className="px-3 py-2 text-left font-bold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                  {isLoading ? 'Đang tải danh sách chấm công…' : 'Không có ca chấm công nào khớp bộ lọc.'}
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} onClick={() => onOpen(it)} className="hover:bg-slate-50 cursor-pointer align-top">
                <td className="px-3 py-2.5">
                  <div className="font-bold text-slate-800">
                    {it.isCompanion ? it.companionName || 'Người đi kèm' : it.surveyorName}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <RoleBadge isCompanion={it.isCompanion} />
                    {it.isCompanion ? (
                      <span className="text-[11px] text-slate-500">
                        Tổ KSV {it.surveyorName}
                        {it.companionPhone ? ` · ${it.companionPhone}` : ''}
                      </span>
                    ) : (
                      it.surveyorCode && <span className="text-[11px] text-slate-500 font-mono">{it.surveyorCode}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <ZoneBadge zoneId={it.zoneId} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="text-[11px] text-slate-400">{it.workDate}</div>
                  <div className="font-semibold text-slate-800">
                    {formatVnTime(it.checkInTime)} → {it.checkOutTime ? formatVnTime(it.checkOutTime) : '---'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {it.checkOutTime ? formatDuration(it.workDurationMinutes) : it.isMissingCheckout ? 'Thiếu Check-out' : 'Đang trong ca'}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1 items-start">
                    <DistanceBadge meters={it.distanceIn} label="Vào" />
                    {it.checkOutTime && <DistanceBadge meters={it.distanceOut} label="Ra" />}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <Thumb url={it.selfieInUrl} alt="Selfie vào ca" />
                    <Thumb url={it.selfieOutUrl} alt="Selfie ra ca" />
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                  {it.isCompanion ? (
                    <span className="text-slate-400">---</span>
                  ) : (
                    <>
                      Tạo <strong>{it.surveysCreatedCount ?? 0}</strong> · Nộp <strong>{it.surveysSubmittedCount ?? 0}</strong>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={it.verificationStatus} />
                      {it.isPeriodLocked && <Lock size={12} className="text-slate-400" aria-label="Kỳ công đã chốt" />}
                    </div>
                    {it.anomalyCodes.map((c) => (
                      <AnomalyBadge key={c} code={c} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-xs text-slate-500">
        <span>
          {total} ca · Trang {page + 1}/{pageCount}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
