/**
 * Tab "Báo Cáo Chung Cư" của module Xuất Phase 1 (chốt 13/11/2026): nơi DUY NHẤT xem / xuất report chung cư.
 * Trái: danh sách tòa trong Zone. Phải: cây của tòa đang chọn — Tòa mẹ → từng tầng → khu vực chung M và căn hộ U.
 * Mỗi nút mở đúng modal xem trước / PDF / Rev dùng chung với nhà dân (qua reportId của từng hồ sơ).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Download, Eye, Layers, Loader2, RefreshCw, Search } from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { METRO_22_ZONES, type MetroZoneConfig } from '../../../../survey-phase1/constants/metroGisConstants';
import type { CondoFloorMatrixRow, CondoFloorMatrixUnitCell } from '../../review-queue/condo/types/condo-audit.types';
import type { ExportParcelItem } from '../types';

interface CondoReportsTabProps {
  zoneId: string;
  onZoneChange: (zoneId: string) => void;
  hideZoneSelect: boolean;
  onOpenPreview: (item: ExportParcelItem) => void;
  onExportPdf: (item: ExportParcelItem) => void;
}

interface CondoTowerListItem {
  parcel_id: string;
  project_parcel_code: string;
  house_number: string | null;
  street: string | null;
  floor_count: number | null;
  master_report_id: string | null;
  master_report_status: string;
  child_unit_count: number | null;
  master_area_count: number | null;
  approved_unit_count: number | null;
  absent_unit_count: number | null;
}

interface TowerTree {
  masterReportId: string | null;
  masterReportStatus: string;
  floorMatrix: CondoFloorMatrixRow[];
}

type KindFilter = 'ALL' | 'MASTER_AREA' | 'CONDO_UNIT';

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'MASTER_AREA', label: 'Khu vực chung (M)' },
  { value: 'CONDO_UNIT', label: 'Căn hộ (U)' },
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUBMITTED: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNDER_REVIEW: { label: 'Đang thẩm định', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  REJECTED: { label: 'Trả về', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  DRAFT: { label: 'Nháp', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  POSTPONED_ABSENT: { label: 'Vắng (chưa xác nhận)', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  POSTPONED_ABSENT_VERIFIED: { label: 'Vắng (đã xác nhận)', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  MISSING: { label: 'Chưa có hồ sơ', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const statusBadge = (status: string | null | undefined): { label: string; className: string } => {
  const key = String(status || 'MISSING').toUpperCase();
  return STATUS_LABELS[key] ?? { label: key, className: 'bg-slate-50 text-slate-600 border-slate-200' };
};

/** Căn vắng hiển thị theo trạng thái building_units; còn lại theo trạng thái hồ sơ khảo sát. */
const cellStatus = (cell: CondoFloorMatrixUnitCell): string => {
  const unitStatus = String(cell.status || '').toUpperCase();
  if (unitStatus.startsWith('POSTPONED_ABSENT')) return unitStatus;
  return String(cell.reportStatus || (cell.reportId ? unitStatus : 'MISSING')).toUpperCase();
};

/** Dựng item cho modal xem trước dùng chung: id / activePhase1ReportId = reportId của chính hồ sơ con. */
const toExportItem = (
  tower: CondoTowerListItem,
  reportId: string,
  status: string,
  unit: CondoFloorMatrixUnitCell | null
): ExportParcelItem => ({
  id: reportId,
  activePhase1ReportId: reportId,
  // Mã hiển thị + tên file PDF: mã tòa, nối mã căn với hồ sơ con để file không trùng tên.
  projectParcelCode: unit ? `${tower.project_parcel_code}_${unit.unitCode}` : tower.project_parcel_code,
  houseNumber: tower.house_number || '',
  street: tower.street || '',
  ownerName: unit?.ownerName || '',
  surveyStatus: status,
  buildingType: 'CONDOMINIUM',
  floorCount: Number(tower.floor_count || 0),
});

const isSingleZone = (zoneId: string): boolean => METRO_22_ZONES.some((z: MetroZoneConfig) => z.code === zoneId);

export const CondoReportsTab: React.FC<CondoReportsTabProps> = ({
  zoneId,
  onZoneChange,
  hideZoneSelect,
  onOpenPreview,
  onExportPdf,
}) => {
  const [towers, setTowers] = useState<CondoTowerListItem[]>([]);
  const [towersLoading, setTowersLoading] = useState(false);
  const [towersError, setTowersError] = useState('');
  const [towerSearch, setTowerSearch] = useState('');
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);

  const [tree, setTree] = useState<TowerTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [unitSearch, setUnitSearch] = useState('');

  const fetchTowers = useCallback(async () => {
    if (!zoneId) return;
    setTowersLoading(true);
    setTowersError('');
    try {
      const res = await api.get('/admin/condo/towers', { params: { zoneId } });
      const list: CondoTowerListItem[] = res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
      setTowers(list);
      setSelectedTowerId((prev) => (prev && list.some((t) => t.parcel_id === prev) ? prev : list[0]?.parcel_id ?? null));
    } catch (err: unknown) {
      console.error('[CondoReportsTab:fetchTowers] Lỗi tải danh sách tòa chung cư:', err);
      setTowersError(getErrorMessage(err));
      setTowers([]);
    } finally {
      setTowersLoading(false);
    }
  }, [zoneId]);

  const fetchTree = useCallback(async (parcelId: string) => {
    setTreeLoading(true);
    setTreeError('');
    try {
      const res = await api.get(`/admin/condo/${encodeURIComponent(parcelId)}/progress-summary`);
      const raw = res.data?.success ? res.data.data : null;
      if (!raw) throw new Error('Phản hồi không có dữ liệu cây tòa nhà');
      setTree({
        masterReportId: raw.masterReport?.id ?? null,
        masterReportStatus: raw.masterReport?.status ?? 'MISSING',
        floorMatrix: Array.isArray(raw.floorMatrix) ? raw.floorMatrix : [],
      });
    } catch (err: unknown) {
      console.error('[CondoReportsTab:fetchTree] Lỗi tải cây tầng của tòa:', err);
      setTreeError(getErrorMessage(err));
      setTree(null);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTowers();
  }, [fetchTowers]);

  useEffect(() => {
    setFloorFilter('ALL');
    setUnitSearch('');
    if (selectedTowerId) fetchTree(selectedTowerId);
    else setTree(null);
  }, [selectedTowerId, fetchTree]);

  const selectedTower = useMemo(
    () => towers.find((t) => t.parcel_id === selectedTowerId) ?? null,
    [towers, selectedTowerId]
  );

  const visibleTowers = useMemo(() => {
    const q = towerSearch.trim().toLowerCase();
    if (!q) return towers;
    return towers.filter((t) =>
      [t.project_parcel_code, t.house_number, t.street].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [towers, towerSearch]);

  const visibleFloors = useMemo(() => {
    if (!tree) return [];
    const q = unitSearch.trim().toLowerCase();
    return tree.floorMatrix
      .filter((f) => floorFilter === 'ALL' || String(f.floorNumber) === floorFilter)
      .map((f) => ({
        ...f,
        units: f.units
          .filter((u) => kindFilter === 'ALL' || u.unitType === kindFilter)
          .filter((u) => !q || [u.unitCode, u.ownerName].some((v) => String(v || '').toLowerCase().includes(q)))
          // Khu vực chung lên trước, sau đó căn hộ theo mã.
          .sort((a, b) => (a.unitType === b.unitType ? a.unitCode.localeCompare(b.unitCode, 'vi', { numeric: true }) : a.unitType === 'MASTER_AREA' ? -1 : 1)),
      }))
      .filter((f) => f.units.length > 0);
  }, [tree, floorFilter, kindFilter, unitSearch]);

  const renderActions = (item: ExportParcelItem | null) => (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => item && onOpenPreview(item)}
        disabled={!item}
        title={item ? 'Xem trước / phát hành Rev' : 'Chưa có hồ sơ khảo sát'}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Eye size={12} /> Xem
      </button>
      <button
        type="button"
        onClick={() => item && onExportPdf(item)}
        disabled={!item}
        title={item ? 'Tải PDF bản hiện hành' : 'Chưa có hồ sơ khảo sát'}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={12} /> PDF
      </button>
    </div>
  );

  const masterItem =
    selectedTower && tree?.masterReportId
      ? toExportItem(selectedTower, tree.masterReportId, tree.masterReportStatus, null)
      : null;
  const masterBadge = statusBadge(tree?.masterReportStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {!hideZoneSelect && (
            <select
              value={zoneId}
              onChange={(e) => onZoneChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {!isSingleZone(zoneId) && <option value={zoneId}>Chọn Zone...</option>}
              {METRO_22_ZONES.map((zone: MetroZoneConfig) => (
                <option key={zone.code} value={zone.code}>
                  {zone.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-slate-500">
            {towers.length} tòa chung cư · mỗi Tòa mẹ, khu vực chung và căn hộ là một file report riêng
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchTowers();
            if (selectedTowerId) fetchTree(selectedTowerId);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw size={14} className={towersLoading || treeLoading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Danh sách tòa */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={towerSearch}
              onChange={(e) => setTowerSearch(e.target.value)}
              placeholder="Tìm mã tòa / địa chỉ"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          {towersError && <div className="mb-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{towersError}</div>}
          {towersLoading && towers.length === 0 ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
          ) : visibleTowers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">Zone này chưa có tòa chung cư.</div>
          ) : (
            <div className="max-h-[65vh] space-y-1 overflow-y-auto">
              {visibleTowers.map((t) => {
                const active = t.parcel_id === selectedTowerId;
                return (
                  <button
                    key={t.parcel_id}
                    type="button"
                    onClick={() => setSelectedTowerId(t.parcel_id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      active ? 'border-indigo-300 bg-indigo-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-500" />
                      <span className="font-mono text-xs font-bold text-slate-800">{t.project_parcel_code}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                      {[t.house_number, t.street].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {t.master_area_count ?? 0} M · {t.child_unit_count ?? 0} U · {t.absent_unit_count ?? 0} vắng
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cây của tòa đang chọn */}
        <div className="space-y-3">
          {!selectedTower ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-xs text-slate-400">
              Chọn một tòa để xem các report.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tòa mẹ</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-teal-700 bg-teal-950 px-2 py-0.5 font-mono text-xs font-bold text-teal-300">
                      {selectedTower.project_parcel_code}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${masterBadge.className}`}>
                      {masterBadge.label}
                    </span>
                  </div>
                </div>
                {renderActions(masterItem)}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <option value="ALL">Tất cả tầng</option>
                  {(tree?.floorMatrix ?? []).map((f) => (
                    <option key={f.floorNumber} value={String(f.floorNumber)}>
                      {f.floorName}
                    </option>
                  ))}
                </select>
                {KIND_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKindFilter(value)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      kindFilter === value
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="relative ml-auto">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Mã căn / chủ hộ"
                    className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {treeError && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{treeError}</div>}
              {treeLoading && !tree ? (
                <div className="flex justify-center py-12 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
              ) : visibleFloors.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
                  Không có khu vực chung / căn hộ khớp bộ lọc.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleFloors.map((floor) => (
                    <div key={floor.floorNumber} className="rounded-2xl border border-slate-200 bg-white shadow-xs">
                      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
                        <Layers size={13} className="text-slate-500" />
                        <span className="text-xs font-black text-slate-800">{floor.floorName}</span>
                        <span className="text-[11px] text-slate-500">
                          {floor.units.filter((u) => u.unitType === 'MASTER_AREA').length} M ·{' '}
                          {floor.units.filter((u) => u.unitType === 'CONDO_UNIT').length} U
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {floor.units.map((u) => {
                          const status = cellStatus(u);
                          const badge = statusBadge(status);
                          const item = u.reportId ? toExportItem(selectedTower, u.reportId, status, u) : null;
                          const isArea = u.unitType === 'MASTER_AREA';
                          return (
                            <div key={u.unitId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${
                                    isArea
                                      ? 'border-cyan-700 bg-cyan-950 text-cyan-300'
                                      : 'border-indigo-700 bg-indigo-950 text-indigo-300'
                                  }`}
                                >
                                  {u.unitCode}
                                </span>
                                <span className="truncate text-xs text-slate-700">
                                  {isArea ? 'Khu vực chung' : u.ownerName || '—'}
                                </span>
                                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>
                                  {badge.label}
                                </span>
                                {u.burlandScore !== null && (
                                  <span className="text-[11px] text-slate-500">Burland {u.burlandScore}</span>
                                )}
                              </div>
                              {renderActions(item)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
