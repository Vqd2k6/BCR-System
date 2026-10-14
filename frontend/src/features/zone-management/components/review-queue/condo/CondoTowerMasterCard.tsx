import React, { useState, useEffect } from 'react';
import {
  Building2,
  DoorOpen,
  Layers,
  UserX,
  AlertTriangle,
  Lock,
  KeyRound,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';

export interface CondoProgressSummaryData {
  parcelId: string;
  projectParcelCode: string;
  houseNumber: string;
  street: string;
  isLocked: boolean;
  sealHash?: string | null;
  lockedAt?: string | null;
  lockedByName?: string | null;
  totalItems: number;
  completedItems: number;
  pendingItems: number;
  progressPercentage: number;
  isReadyForFinalSeal: boolean;
  blockingItems: string[];
  counts: {
    masterAreas: { total: number; approved: number };
    units: { total: number; approved: number; absentVerified: number; pending: number };
    criticalCracks: number;
  };
}

interface Props {
  tower: PendingSubmissionItem;
  onSelectTower: (parcelId: string, towerItem: PendingSubmissionItem) => void;
  onOpenMasterStudio: (reportId: string | null) => void;
}

export const CondoTowerMasterCard: React.FC<Props> = ({
  tower,
  onSelectTower,
  onOpenMasterStudio,
}) => {
  const [summary, setSummary] = useState<CondoProgressSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/admin/condo/${tower.parcel_id}/progress-summary`);
        if (res.data?.success && res.data.data && isMounted) {
          const raw = res.data.data;
          const normalized: CondoProgressSummaryData = {
            parcelId: raw.parcel?.id || tower.parcel_id,
            projectParcelCode: raw.parcel?.projectParcelCode || tower.project_parcel_code,
            houseNumber: raw.parcel?.houseNumber || tower.house_number,
            street: raw.parcel?.street || tower.street,
            isLocked: Boolean(raw.parcel?.isLocked ?? raw.isLocked ?? tower.parent_parcel_is_locked),
            sealHash: raw.parcel?.sealHash || raw.sealHash || tower.parent_parcel_seal_hash,
            lockedAt: raw.parcel?.lockedAt || raw.lockedAt || tower.parent_parcel_locked_at,
            lockedByName: raw.parcel?.lockedByName || raw.lockedByName || tower.parent_parcel_locked_by_name,
            totalItems: Number(raw.stats?.totalItems ?? raw.totalItems ?? 0),
            completedItems: Number(raw.stats?.completedItems ?? raw.completedItems ?? 0),
            pendingItems: Number((raw.stats?.childUnits?.submitted || 0) + (raw.stats?.masterAreas?.submitted || 0)),
            progressPercentage: Number(raw.stats?.completionRatePercent ?? raw.progressPercentage ?? 0),
            isReadyForFinalSeal: Boolean(raw.isReadyForFinalSeal),
            blockingItems: Array.isArray(raw.blockingItems) ? raw.blockingItems : [],
            counts: {
              masterAreas: {
                total: Number(raw.stats?.masterAreas?.total ?? raw.counts?.masterAreas?.total ?? 0),
                approved: Number(raw.stats?.masterAreas?.approved ?? raw.counts?.masterAreas?.approved ?? 0),
              },
              units: {
                total: Number(raw.stats?.childUnits?.total ?? raw.counts?.units?.total ?? 0),
                approved: Number(raw.stats?.childUnits?.approved ?? raw.counts?.units?.approved ?? 0),
                absentVerified: Number(raw.stats?.childUnits?.absentVerified ?? raw.counts?.units?.absentVerified ?? 0),
                pending: Number(raw.stats?.childUnits?.submitted ?? raw.counts?.units?.pending ?? 0),
              },
              criticalCracks: Number(raw.stats?.criticalCracks ?? raw.counts?.criticalCracks ?? 0),
            },
          };
          setSummary(normalized);
        }
      } catch (err: unknown) {
        console.error('[CondoTowerMasterCard] Lỗi tải tóm tắt tiến độ tòa:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [tower.parcel_id]);

  const isLocked = Boolean(tower.parent_parcel_is_locked || summary?.isLocked);
  const sealHash = summary?.sealHash || tower.parent_parcel_seal_hash;
  const lockedAt = summary?.lockedAt || tower.parent_parcel_locked_at;
  const lockedByName = summary?.lockedByName || tower.parent_parcel_locked_by_name || 'Trưởng Zone';

  const progressPct = summary?.progressPercentage ?? 0;
  const isReadyToSeal = summary?.isReadyForFinalSeal && !isLocked;

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sealHash) return;
    navigator.clipboard.writeText(sealHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div
      className={`rounded-2xl p-5 border transition-all duration-200 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md flex flex-col justify-between gap-4 ${
        isLocked
          ? 'border-emerald-500/40 bg-gradient-to-b from-white to-emerald-50/10 dark:from-slate-900 dark:to-emerald-950/10'
          : isReadyToSeal
          ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20 dark:bg-emerald-950/10'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                isLocked
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                  {tower.house_number || tower.project_parcel_code}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {tower.project_parcel_code}
                </span>
                {isLocked ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>ĐÃ KHÓA SỔ</span>
                  </span>
                ) : isReadyToSeal ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>SẴN SÀNG NIÊM PHONG</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>ĐANG THẨM ĐỊNH</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tower.street || 'Đang cập nhật địa chỉ'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <span>Tiến độ tổng thể</span>
              {loading && <span className="animate-spin text-slate-400">⏳</span>}
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {summary ? `${summary.completedItems} / ${summary.totalItems} mục (${progressPct}%)` : 'Đang tính...'}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isLocked
                  ? 'bg-emerald-500'
                  : progressPct === 100
                  ? 'bg-emerald-500'
                  : progressPct >= 50
                  ? 'bg-indigo-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Detailed Breakdown Chips */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
            {/* Common Areas */}
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <Layers className="w-3 h-3 text-indigo-500" />
                <span>Khu Dùng Chung</span>
              </div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {summary.counts.masterAreas.approved} / {summary.counts.masterAreas.total}
              </div>
            </div>

            {/* Units */}
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <DoorOpen className="w-3 h-3 text-teal-500" />
                <span>Căn Hộ Con</span>
              </div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {summary.counts.units.approved} / {summary.counts.units.total}
                {summary.counts.units.pending > 0 && (
                  <span className="text-[10px] text-amber-600 font-normal ml-1">
                    (Chờ: {summary.counts.units.pending})
                  </span>
                )}
              </div>
            </div>

            {/* Absent */}
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <UserX className="w-3 h-3 text-purple-500" />
                <span>Vắng Chủ Hộ</span>
              </div>
              <div className="font-mono font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                {summary.counts.units.absentVerified} đã duyệt
              </div>
            </div>

            {/* Critical Cracks */}
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span>Nứt Cấp ≥ 3</span>
              </div>
              <div
                className={`font-mono font-bold mt-0.5 ${
                  summary.counts.criticalCracks > 0
                    ? 'text-red-600 animate-pulse'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {summary.counts.criticalCracks} vị trí
              </div>
            </div>
          </div>
        )}

        {/* Legal Seal Info Block (if locked) */}
        {isLocked && (
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ĐÃ KHÓA SỔ PHÁP LÝ TOÀN TÒA</span>
              </span>
              <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                BẤT BIẾN
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              <span>Người niêm phong: </span>
              <strong className="text-white">{lockedByName}</strong>
              {lockedAt && (
                <>
                  <span className="mx-1">•</span>
                  <span>
                    {new Date(lockedAt).toLocaleDateString('vi-VN')}{' '}
                    {new Date(lockedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
            {sealHash && (
              <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-800/80 p-1.5 rounded border border-slate-700/80">
                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">SHA-256: {sealHash}</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="text-sky-400 hover:text-sky-300 hover:underline shrink-0 flex items-center gap-0.5 cursor-pointer ml-auto"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHash ? 'Đã chép' : 'Chép'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Guide Notice if ready to seal */}
        {isReadyToSeal && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              100% hạng mục đã hoàn thành đạt chuẩn. Mở <strong>Studio Tòa Mẹ</strong> để thẩm định biên bản BQL và ký niêm phong pháp lý.
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onOpenMasterStudio(tower.report_id)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Mở Studio thẩm định hồ sơ kỹ thuật tòa nhà mẹ"
        >
          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Studio Tòa Mẹ</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTower(tower.parcel_id, tower)}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          title="Vào không gian thẩm định chi tiết các căn hộ của tòa này"
        >
          <DoorOpen className="w-4 h-4 shrink-0" />
          <span>Xem & Thẩm Định Căn Hộ</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
};
