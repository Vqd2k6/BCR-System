import React, { useState, useEffect, useCallback } from 'react';
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
  Grid,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import type { CondoFloorMatrixRow, CondoParentMasterSummary } from './types/condo-audit.types';
import { CondoFinalSealModal, type CondoBlockingItem } from './seal/CondoFinalSealModal';
import { CondoFloorMatrixDrawer } from './queue/CondoFloorMatrixDrawer';

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
  blockingItems: CondoBlockingItem[];
  masterReportId: string | null;
  masterReportStatus: string;
  parentMasterSummary?: CondoParentMasterSummary | null;
  floorMatrix: CondoFloorMatrixRow[];
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
  const [showSealModal, setShowSealModal] = useState(false);
  const [showFloorMatrix, setShowFloorMatrix] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/condo/${tower.parcel_id}/progress-summary`);
      if (res.data?.success && res.data.data) {
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
          pendingItems: Number(
            (raw.stats?.childUnits?.submitted || 0) + (raw.stats?.masterAreas?.submitted || 0)
          ),
          progressPercentage: Number(
            raw.stats?.completionRatePercent ?? raw.progressPercentage ?? 0
          ),
          isReadyForFinalSeal: Boolean(raw.isReadyForFinalSeal),
          blockingItems: Array.isArray(raw.blockingItems) ? raw.blockingItems : [],
          masterReportId: raw.masterReport?.id || tower.report_id || null,
          masterReportStatus: raw.masterReport?.status || tower.status || 'MISSING',
          parentMasterSummary: raw.parentMasterSummary || null,
          floorMatrix: Array.isArray(raw.floorMatrix) ? raw.floorMatrix : [],
          counts: {
            masterAreas: {
              total: Number(raw.stats?.masterAreas?.total ?? raw.counts?.masterAreas?.total ?? 0),
              approved: Number(
                raw.stats?.masterAreas?.approved ?? raw.counts?.masterAreas?.approved ?? 0
              ),
            },
            units: {
              total: Number(raw.stats?.childUnits?.total ?? raw.counts?.units?.total ?? 0),
              approved: Number(
                raw.stats?.childUnits?.approved ?? raw.counts?.units?.approved ?? 0
              ),
              absentVerified: Number(
                raw.stats?.childUnits?.absentVerified ?? raw.counts?.units?.absentVerified ?? 0
              ),
              pending: Number(
                raw.stats?.childUnits?.submitted ?? raw.counts?.units?.pending ?? 0
              ),
            },
            criticalCracks: Number(
              raw.stats?.criticalCracks ?? raw.counts?.criticalCracks ?? 0
            ),
          },
        };
        setSummary(normalized);
      }
    } catch (err: unknown) {
      console.error('[CondoTowerMasterCard] Lỗi tải tóm tắt tiến độ tòa:', err);
    } finally {
      setLoading(false);
    }
  }, [
    tower.parcel_id,
    tower.project_parcel_code,
    tower.house_number,
    tower.street,
    tower.parent_parcel_is_locked,
    tower.parent_parcel_seal_hash,
    tower.parent_parcel_locked_at,
    tower.parent_parcel_locked_by_name,
    tower.report_id,
    tower.status,
  ]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const isLocked = Boolean(tower.parent_parcel_is_locked || summary?.isLocked);
  const sealHash = summary?.sealHash || tower.parent_parcel_seal_hash;
  const lockedAt = summary?.lockedAt || tower.parent_parcel_locked_at;
  const lockedByName = summary?.lockedByName || tower.parent_parcel_locked_by_name || 'Trưởng Zone';

  const progressPct = summary?.progressPercentage ?? 0;
  const isReadyToSeal = Boolean(summary?.isReadyForFinalSeal && !isLocked);
  const masterReportId = summary?.masterReportId || tower.report_id;
  const masterStatus = summary?.masterReportStatus || tower.status || 'MISSING';

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sealHash) return;
    navigator.clipboard.writeText(sealHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <>
      <div
        className={`rounded-2xl p-5 border transition-all duration-200 bg-white shadow-xs hover:shadow-md flex flex-col justify-between gap-4 ${
          isLocked
            ? 'border-emerald-500/40 bg-gradient-to-b from-white to-emerald-50/10'
            : isReadyToSeal
              ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20'
              : 'border-slate-200'
        }`}
      >
        <div className="space-y-3">
          {/* Top Header */}
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
                  <h3 className="font-black text-sm text-slate-800">
                    {tower.house_number || tower.project_parcel_code}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-200">
                    {tower.project_parcel_code}
                  </span>
                  {isLocked ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>ĐÃ KHÓA SỔ SHA-256</span>
                    </span>
                  ) : isReadyToSeal ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>ĐỦ ĐIỀU KIỆN KHÓA SỔ</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>ĐANG THẨM ĐỊNH</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tower.street || 'Đang cập nhật địa chỉ'}
                </p>
              </div>
            </div>

            {/* Master Report Status Pill */}
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Hồ sơ Tòa Mẹ</div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border mt-0.5 ${
                  masterStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : masterStatus === 'MISSING'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
              >
                {masterStatus === 'APPROVED' ? 'ĐÃ DUYỆT MASTER' : `MASTER: ${masterStatus}`}
              </span>
            </div>
          </div>

          {/* Live Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <span>Tiến độ Khu vực chung &amp; Căn hộ</span>
                {loading && <span className="animate-spin text-slate-400">⏳</span>}
              </span>
              <span className="font-mono font-bold text-slate-700">
                {summary
                  ? `${summary.completedItems} / ${summary.totalItems} mục (${progressPct}%)`
                  : 'Đang tính...'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isLocked || progressPct === 100
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <Layers className="w-3 h-3 text-indigo-500" />
                  <span>Khu Dùng Chung</span>
                </div>
                <div className="font-mono font-bold text-slate-800 mt-0.5">
                  {summary.counts.masterAreas.approved} / {summary.counts.masterAreas.total}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <DoorOpen className="w-3 h-3 text-teal-500" />
                  <span>Căn Hộ Con</span>
                </div>
                <div className="font-mono font-bold text-slate-800 mt-0.5">
                  {summary.counts.units.approved} / {summary.counts.units.total}
                  {summary.counts.units.pending > 0 && (
                    <span className="text-[10px] text-amber-600 font-normal ml-1">
                      (Chờ: {summary.counts.units.pending})
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <UserX className="w-3 h-3 text-purple-500" />
                  <span>Vắng Chủ Hộ</span>
                </div>
                <div className="font-mono font-bold text-purple-700 mt-0.5">
                  {summary.counts.units.absentVerified} đã duyệt
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span>Nứt Cấp ≥ 3</span>
                </div>
                <div
                  className={`font-mono font-bold mt-0.5 ${
                    summary.counts.criticalCracks > 0
                      ? 'text-red-600 animate-pulse'
                      : 'text-slate-700'
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
                      {new Date(lockedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
                    {copiedHash ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedHash ? 'Đã chép' : 'Chép'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Separated Clearly */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5">
            {masterReportId && (
              <button
                type="button"
                onClick={() => onOpenMasterStudio(masterReportId)}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mở Studio 5 bước thẩm định hồ sơ kỹ thuật tòa nhà mẹ"
              >
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Studio Tòa Mẹ (5 Bước)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFloorMatrix(true)}
              className="px-2.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Xem Ma trận không gian tầng & mặt bằng CAD"
            >
              <Grid className="w-3.5 h-3.5 text-teal-600" />
              <span>Ma Trận Tầng</span>
            </button>

            {!isLocked && (
              <button
                type="button"
                onClick={() => setShowSealModal(true)}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                  isReadyToSeal
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Kiểm tra điều kiện & Khóa sổ pháp lý SHA-256 toàn tòa"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Khóa Sổ</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectTower(tower.parcel_id, tower)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Vào không gian thẩm định chi tiết các khu vực chung & căn hộ của tòa này"
          >
            <DoorOpen className="w-4 h-4 shrink-0" />
            <span>DS Khu Chung &amp; Căn Hộ</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {showSealModal && summary && (
        <CondoFinalSealModal
          isOpen={showSealModal}
          parcelId={tower.parcel_id}
          projectParcelCode={tower.project_parcel_code}
          buildingName={tower.house_number || tower.project_parcel_code}
          masterReportId={masterReportId}
          masterReportStatus={masterStatus}
          totalItems={summary.totalItems}
          completedItems={summary.completedItems}
          isReadyForFinalSeal={summary.isReadyForFinalSeal}
          blockingItems={summary.blockingItems}
          onClose={() => setShowSealModal(false)}
          onSuccess={fetchSummary}
          onOpenReportStudio={(repId) => onOpenMasterStudio(repId)}
        />
      )}

      {showFloorMatrix && summary && (
        <CondoFloorMatrixDrawer
          isOpen={showFloorMatrix}
          towerName={tower.house_number || tower.project_parcel_code}
          towerParcelCode={tower.project_parcel_code}
          floorMatrix={summary.floorMatrix}
          onClose={() => setShowFloorMatrix(false)}
          onSelectUnitReport={(repId) => onOpenMasterStudio(repId)}
        />
      )}
    </>
  );
};
