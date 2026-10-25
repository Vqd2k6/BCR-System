import React from 'react';
import {
  Building2,
  ShieldCheck,
  ExternalLink,
  Lock,
  Layers,
  Compass,
  Award,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep1ParentInheritance: React.FC<
  CondoAuditStepProps<CondoUnitFormState>
> = ({ data, parentMasterSummary, onOpenMasterReportById }) => {
  const pInfo = data.parentBuildingInfo;
  const masterReportId = String(
    parentMasterSummary?.masterReportId || pInfo?.masterReportId || ''
  );
  const buildingName = String(
    parentMasterSummary?.buildingName ||
      pInfo?.buildingName ||
      data.houseNumber ||
      'Tòa nhà Chung cư gốc'
  );
  const parcelCode = String(
    parentMasterSummary?.projectParcelCode ||
      pInfo?.projectParcelCode ||
      data.projectParcelCode ||
      'N/A'
  );
  const aboveFloors = Number(parentMasterSummary?.aboveFloors ?? 0);
  const undergroundFloors = Number(
    parentMasterSummary?.undergroundFloors ??
      parentMasterSummary?.basementFloors ??
      0
  );
  const structureSystem = String(
    parentMasterSummary?.structureSystem || 'Khung - Vách cứng BTCT toàn khối'
  );
  const foundationCat = Number(
    parentMasterSummary?.foundationCatScore ??
      data.leftPane?.riskScoreCard?.f_foundation_cat ??
      1
  );
  const metroDist = Number(
    parentMasterSummary?.distanceToCenterlineM ??
      data.leftPane?.metroClearanceM ??
      0
  );
  const totalEcs = Number(
    parentMasterSummary?.totalEcs ??
      data.leftPane?.riskScoreCard?.ecs_total ??
      0
  );
  const avgVi = Number(
    parentMasterSummary?.avgVi ?? data.leftPane?.riskScoreCard?.vi_index ?? 0
  );
  const braRating = String(
    parentMasterSummary?.braRating ||
      data.leftPane?.riskScoreCard?.bra_category ||
      'VERY_LOW'
  );
  const masterStatus = String(
    parentMasterSummary?.masterStatus || pInfo?.masterStatus || 'PENDING'
  );
  const isMasterApproved =
    masterStatus === 'APPROVED' || masterStatus === 'COMPLETED';
  const isLocked = Boolean(parentMasterSummary?.isLocked || pInfo?.isLocked);

  return (
    <div className="space-y-4">
      {/* Banner trạng thái kế thừa từ Hồ sơ Tổng Khối Tháp */}
      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          isMasterApproved
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isMasterApproved
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white'
            }`}
          >
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Kế thừa Thông số Kỹ thuật Khối Tháp Cha (BUILDING_MASTER)
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isMasterApproved
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}
              >
                {isMasterApproved ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Đã phê duyệt Master
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Master: {masterStatus}
                  </>
                )}
              </span>
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <Lock className="w-3 h-3" /> Đã niêm phong pháp lý
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Căn hộ con kế thừa tự động hệ kết cấu chịu lực, phân hạng móng CAT,
              khoảng cách tịnh không đến tim hầm Metro và chỉ số ECS/VI/BRA nền từ{' '}
              <strong className="font-bold text-slate-900 dark:text-white">
                {buildingName} ({parcelCode})
              </strong>
              . Mọi chỉnh sửa tại căn hộ con hoàn toàn cô lập, không ghi đè dữ liệu
              khối tháp cha.
            </p>
          </div>
        </div>

        {masterReportId && onOpenMasterReportById && (
          <button
            type="button"
            onClick={() => onOpenMasterReportById(masterReportId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Hồ sơ Tổng Khối Tháp
          </button>
        )}
      </div>

      {/* Lưới thông số kỹ thuật kế thừa (Read-Only) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Quy mô & Hệ kết cấu chịu lực
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Tòa nhà:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {buildingName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Quy mô tầng:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {aboveFloors > 0 ? `${aboveFloors} tầng nổi / ${undergroundFloors} hầm` : 'Theo hồ sơ Master'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Hệ kết cấu:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                {structureSystem}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Hạng móng CAT & Khoảng cách Metro
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Phân hạng móng:</span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 font-black">
                CAT {foundationCat}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Cự ly đến tim Metro:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {Number(metroDist).toFixed(1)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Mã lô đất (Parcel):</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {parcelCode}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Chỉ số Rủi ro Khối Tháp (ECS / VI / BRA)
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-white dark:bg-slate-900 p-2 text-center border border-slate-200/70 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold">ECS</div>
              <div className="text-sm font-black text-blue-600 dark:text-blue-400">
                {Number(totalEcs).toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-900 p-2 text-center border border-slate-200/70 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold">VI</div>
              <div className="text-sm font-black text-purple-600 dark:text-purple-400">
                {Number(avgVi).toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-900 p-2 text-center border border-slate-200/70 dark:border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold">BRA</div>
              <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 truncate">
                {braRating}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ghi chú pháp lý */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>
          <strong>Chế độ Bảo toàn Dữ liệu Gốc (Strict Condo Isolation):</strong> Khi
          thẩm định hoặc Rollback phiên bản của căn hộ{' '}
          <code className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {data.unitCode || 'CONDO_UNIT'}
          </code>
          , hệ thống chỉ cập nhật bảng{' '}
          <code className="font-mono">building_units</code> và{' '}
          <code className="font-mono">survey_reports</code> của căn hộ này, tuyệt đối
          không làm thay đổi thông tin chủ sở hữu hoặc địa chỉ của Tòa nhà gốc trên bảng{' '}
          <code className="font-mono">parcels</code>.
        </span>
      </div>
    </div>
  );
};
