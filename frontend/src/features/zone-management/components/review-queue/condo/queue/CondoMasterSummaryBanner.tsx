import React from 'react';
import {
  Building2,
  FileSearch,
  Lock,
  Grid,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import type { CondoParentMasterSummary } from '../types/condo-audit.types';

interface CondoMasterSummaryBannerProps {
  towerParcelCode: string;
  towerName: string;
  masterReportId: string | null;
  masterReportStatus: string;
  parentMasterSummary?: CondoParentMasterSummary | null;
  floorPlanCount: number;
  totalItems: number;
  completedItems: number;
  isReadyForFinalSeal: boolean;
  isParentLocked: boolean;
  sealHash?: string | null;
  onOpenMasterStudio: (reportId: string) => void;
  onPreviewMasterReport: (reportId: string) => void;
  onOpenFloorMatrix: () => void;
  onOpenFinalSealModal: () => void;
}

export const CondoMasterSummaryBanner: React.FC<CondoMasterSummaryBannerProps> = ({
  towerParcelCode,
  towerName,
  masterReportId,
  masterReportStatus,
  parentMasterSummary,
  floorPlanCount,
  totalItems,
  completedItems,
  isReadyForFinalSeal,
  isParentLocked,
  sealHash,
  onOpenMasterStudio,
  onPreviewMasterReport,
  onOpenFloorMatrix,
  onOpenFinalSealModal,
}) => {
  const isMasterApproved = masterReportStatus === 'APPROVED';

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-teal-50/40 p-4 shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Master Report Identity & Status */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                Hồ Sơ Gốc Tòa Nhà Mẹ (Building Master - 5 Bước)
              </span>
              {isMasterApproved ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>ĐÃ PHÊ DUYỆT MASTER</span>
                </span>
              ) : masterReportId ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>TRẠNG THÁI: {masterReportStatus}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>CHƯA NỘP HỒ SƠ TÒA MẸ</span>
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                Khối tháp: <strong className="text-slate-900">{towerName}</strong> ({towerParcelCode})
              </span>
              {parentMasterSummary && (
                <>
                  <span>•</span>
                  <span>
                    Quy mô:{' '}
                    <strong>
                      {parentMasterSummary.aboveFloors ?? '--'} tầng nổi /{' '}
                      {parentMasterSummary.basementFloors ?? 0} hầm
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Hệ kết cấu:{' '}
                    <strong>{parentMasterSummary.structureSystem || 'Khung - Vách BTCT'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Hạng móng:{' '}
                    <strong className="text-indigo-700">
                      CAT {parentMasterSummary.foundationCatScore ?? '--'}
                    </strong>
                  </span>
                  {parentMasterSummary.totalEcs !== null && (
                    <>
                      <span>•</span>
                      <span>
                        ECS: <strong>{parentMasterSummary.totalEcs}</strong> | VI:{' '}
                        <strong>{parentMasterSummary.avgVi ?? '--'}</strong> | BRA:{' '}
                        <strong className="text-rose-600">
                          {parentMasterSummary.braRating || 'MEDIUM'}
                        </strong>
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons Separated Clearly */}
        <div className="flex items-center gap-2 flex-wrap">
          {masterReportId && (
            <>
              <button
                type="button"
                onClick={() => onOpenMasterStudio(masterReportId)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <FileSearch className="w-4 h-4" />
                <span>Thẩm Định Hồ Sơ Tòa Mẹ (5 Bước)</span>
              </button>

              <button
                type="button"
                onClick={() => onPreviewMasterReport(masterReportId)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem Báo Cáo Tòa Mẹ</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenFloorMatrix}
            className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5 text-teal-600" />
            <span>Ma Trận Tầng &amp; CAD ({floorPlanCount} tầng)</span>
          </button>

          {isParentLocked ? (
            <div
              className="px-3 py-2 rounded-xl bg-emerald-900 text-emerald-300 border border-emerald-700 text-xs font-mono font-bold flex items-center gap-1.5"
              title={sealHash ? `SHA-256: ${sealHash}` : 'Đã khóa sổ pháp lý'}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>ĐÃ NIÊM PHONG SHA-256</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenFinalSealModal}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                isReadyForFinalSeal
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                Khóa Sổ Pháp Lý ({completedItems}/{totalItems})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

