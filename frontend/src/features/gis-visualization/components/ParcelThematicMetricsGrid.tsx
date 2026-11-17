import React from 'react';
import type { GisParcel } from '../../../components/gis/shared/types';
import { isNonBuildingParcel } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import { REPORT_STATUS_LINE } from '../registry/thematicBinding';
import {
  BRA_SCALE,
  BURLAND_SCALE,
  ECS_SCALE,
  FLOOR_TIER_SCALE,
  FOUNDATION_CAT_SCALE,
  FOUNDATION_TYPE_SCALE,
  STRUCTURE_SCALE,
  VI_SCALE,
  YEAR_SCALE,
} from '../registry/thematicLayouts.registry';
import type { ThematicScale } from '../registry/thematicLayouts.registry';
import type { GisThematicLayoutId, ParcelThematicMetrics } from '../types';

interface MetricCell {
  layoutId: GisThematicLayoutId;
  title: string;
  /** Thang lấy màu chấm + dòng giá trị (khớp 100% màu polygon trên bản đồ). */
  scale: ThematicScale;
  /** Dòng phụ (vd CAT hồ sơ móng dưới ô Loại móng). */
  extra?: { scale: ThematicScale };
}

const CELLS: MetricCell[] = [
  { layoutId: 'CONSTRUCTION_YEAR', title: 'Năm xây dựng', scale: YEAR_SCALE },
  { layoutId: 'FLOOR_COUNT', title: 'Số tầng', scale: FLOOR_TIER_SCALE },
  { layoutId: 'FOUNDATION_STRUCTURE', title: 'Loại móng', scale: FOUNDATION_TYPE_SCALE, extra: { scale: FOUNDATION_CAT_SCALE } },
  { layoutId: 'FOUNDATION_STRUCTURE', title: 'Hệ kết cấu', scale: STRUCTURE_SCALE },
  { layoutId: 'STRUCTURAL_CONDITION', title: 'Tình trạng kết cấu', scale: ECS_SCALE },
  { layoutId: 'BURLAND_GRADE', title: 'Cấp Burland', scale: BURLAND_SCALE },
  { layoutId: 'VI_INDEX', title: 'Chỉ số dễ tổn thương', scale: VI_SCALE },
  { layoutId: 'BRA_RISK', title: 'Rủi ro BRA', scale: BRA_SCALE },
];

/** Bỏ tiền tố "Năm XD: ", "ECS: "… của dòng tooltip vì ô đã có tiêu đề. */
const stripPrefix = (text: string): string => text.replace(/^[^:]{1,30}:\s*/, '');

function Dot({ hex }: { hex: string | null }) {
  return (
    <span
      className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300"
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

function cellValue(scale: ThematicScale, metrics: ParcelThematicMetrics | undefined): { text: string | null; hex: string | null } {
  if (!metrics) return { text: null, hex: null };
  const key = scale.classify(metrics);
  const text = scale.valueText(metrics);
  const hex = key ? scale.buckets.find((b) => b.key === key)?.hex ?? null : null;
  return { text: text ? stripPrefix(text) : null, hex };
}

interface Props {
  parcel: GisParcel;
  metrics: ParcelThematicMetrics | undefined;
  /** Layout đang xem trên bản đồ — ô tương ứng được viền nổi. */
  activeLayoutId: GisThematicLayoutId;
}

/**
 * Đủ chỉ số 7 layout chuyên đề của 1 thửa (layout thứ 8 — Hiện trạng khảo sát — đã có ở thẻ/bảng chi tiết).
 * Dữ liệu lấy từ cùng API /gis-visualization/thematic, nên khớp PDF Mục VIII như bản đồ.
 */
export const ParcelThematicMetricsGrid: React.FC<Props> = ({ parcel, metrics, activeLayoutId }) => {
  const nonBuilding = Boolean(metrics?.isVacantLand) || (!metrics && isNonBuildingParcel(parcel));
  const statusLine = metrics?.reportStatus ? REPORT_STATUS_LINE[metrics.reportStatus] : 'Chưa có hồ sơ đã nộp — chưa có số liệu';
  const pending = Boolean(metrics?.reportStatus && metrics.reportStatus !== 'APPROVED');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="font-bold text-slate-700">Chỉ số chuyên đề</span>
        <span className={pending ? 'font-semibold text-amber-700' : 'text-slate-500'}>{statusLine}</span>
      </div>
      {nonBuilding ? (
        <div className="text-[11px] text-slate-500">Đất trống / Hạ tầng (phi công trình): không có chỉ số công trình.</div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {CELLS.map((cell) => {
            const main = cellValue(cell.scale, metrics);
            const extra = cell.extra ? cellValue(cell.extra.scale, metrics) : null;
            const isActive = cell.layoutId === activeLayoutId;
            return (
              <div
                key={cell.title}
                className={`rounded-lg border bg-white px-2 py-1.5 text-[11px] ${
                  isActive ? 'border-sky-500 ring-1 ring-sky-300' : 'border-slate-200'
                }`}
              >
                <div className="text-[10px] text-slate-500">{cell.title}</div>
                <div className="flex items-start gap-1.5">
                  <Dot hex={main.hex} />
                  <span className={main.text ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                    {main.text ?? 'Chưa có số liệu'}
                  </span>
                </div>
                {extra && (
                  <div className="mt-0.5 flex items-start gap-1.5">
                    <Dot hex={extra.hex} />
                    <span className={extra.text ? 'text-slate-700' : 'text-slate-400'}>{extra.text ?? 'CAT: chưa có'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {(metrics?.isCondoMaster || parcel.buildingType === 'CONDOMINIUM') && (
        <div className="mt-1.5 text-[10px] text-violet-700">Chung cư: số liệu theo Báo cáo Master.</div>
      )}
    </div>
  );
};
