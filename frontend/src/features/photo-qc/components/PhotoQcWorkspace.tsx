import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Flag, Images, Loader2, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '../../../utils/errorUtils';
import { downloadRecaptureList, fetchPhotoQcDetail, fetchPhotoQcList, savePhotoQcReport } from '../api/photoQc.api';
import type {
  NaturalSize,
  PhotoQcListFilter,
  PhotoQcListItem,
  PhotoQcRecaptureLevel,
  PhotoQcReportKind,
  PhotoQcReportUpdate,
  PhotoQcSlotView,
} from '../types';
import { KIND_LABEL, LEVEL_LABEL, STATION_OPTIONS } from '../types';
import { isStandardRatio, rotatedSize } from '../utils/photoQcGeometry';
import { PhotoQcDetailModal } from './PhotoQcDetailModal';
import { RotatedPhoto } from './RotatedPhoto';

const PAGE_SIZE = 20;

export interface PhotoQcWorkspaceProps {
  /** Zone đang làm việc của màn hình chứa ('ALL' = toàn tuyến, chỉ Super Admin). */
  zoneId: string;
}

const FILTER_LABEL: Record<PhotoQcListFilter, string> = {
  ALL: 'Tất cả',
  UNREVIEWED: 'Chưa rà',
  FLAGGED: 'Có cờ chụp lại',
  REVIEWED: 'Đã rà',
};

function photoKeyOfCover(item: PhotoQcListItem): string {
  return item.qc?.coverSource === 'P04' ? 'P-04' : 'P-02';
}

/**
 * Màn rà soát ảnh hồ sơ (Photo QC): mỗi hồ sơ một hàng ảnh P như bản in, đổi bìa P04,
 * mức thu thập lại, đánh dấu đã rà; bấm "Chi tiết" để crop / gắn cờ từng ảnh.
 * Ảnh tải thẳng từ R2 (không qua backend), lazy-load theo trang 20 hồ sơ.
 */
export const PhotoQcWorkspace: React.FC<PhotoQcWorkspaceProps> = ({ zoneId }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [station, setStation] = useState<string>('');
  const [kind, setKind] = useState<PhotoQcReportKind | ''>('');
  const [filter, setFilter] = useState<PhotoQcListFilter>('UNREVIEWED');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [onlyBadRatio, setOnlyBadRatio] = useState(false);
  const [items, setItems] = useState<PhotoQcListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [exportLevel, setExportLevel] = useState<PhotoQcRecaptureLevel | ''>('');
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const sizes = useRef<Map<string, NaturalSize>>(new Map());
  const [, setSizeTick] = useState(0);
  const requestSeq = useRef(0);

  const zoneParam = zoneId && zoneId !== 'ALL' ? zoneId : undefined;

  const loadPage = useCallback(
    async (append: boolean, after: string | null) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPhotoQcList({
          zone: zoneParam,
          station: station || undefined,
          kind: kind || undefined,
          filter,
          q: query || undefined,
          cursor: after ?? undefined,
          limit: PAGE_SIZE,
        });
        if (seq !== requestSeq.current) return;
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
      } catch (err: unknown) {
        console.error('[PhotoQc:Workspace.loadPage] Không tải được danh sách hồ sơ', err);
        if (seq === requestSeq.current) setError(getErrorMessage(err, 'Không tải được danh sách hồ sơ'));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [zoneParam, station, kind, filter, query]
  );

  useEffect(() => {
    void loadPage(false, null);
  }, [loadPage]);

  /** Cập nhật lại một hàng sau khi sửa trong modal chi tiết (không tải lại cả trang). */
  const refreshRow = useCallback(async (reportId: string) => {
    try {
      const d = await fetchPhotoQcDetail(reportId);
      setItems((prev) =>
        prev.map((it) =>
          it.reportId !== reportId
            ? it
            : {
                ...it,
                qc: d.qc,
                suggestedLevel: d.suggestedLevel,
                openFlagCount: d.photos.filter((p) => p.qc?.recapture && p.qc.status !== 'RESOLVED').length,
                pPhotos: it.pPhotos.map((p) => d.photos.find((x) => x.photoKey === p.photoKey) ?? p),
              }
        )
      );
    } catch (err: unknown) {
      console.error('[PhotoQc:Workspace.refreshRow] Không làm mới được hàng hồ sơ', err);
    }
  }, []);

  const saveRow = async (item: PhotoQcListItem, body: PhotoQcReportUpdate) => {
    setSavingId(item.reportId);
    setError(null);
    try {
      const qc = await savePhotoQcReport(item.reportId, body);
      setItems((prev) => prev.map((it) => (it.reportId === item.reportId ? { ...it, qc } : it)));
    } catch (err: unknown) {
      console.error('[PhotoQc:Workspace.saveRow] Không lưu được thông tin hồ sơ', err);
      setError(`${item.reportCode}: ${getErrorMessage(err, 'Không lưu được')}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadRecaptureList({ zone: zoneParam, station: station || undefined, level: exportLevel || undefined });
    } catch (err: unknown) {
      console.error('[PhotoQc:Workspace.handleExport] Không xuất được danh sách chụp lại', err);
      setError(getErrorMessage(err, 'Không xuất được danh sách chụp lại'));
    } finally {
      setExporting(false);
    }
  };

  const hasBadRatio = (item: PhotoQcListItem): boolean =>
    item.pPhotos.some((p) => {
      const s = sizes.current.get(`${item.reportId}|${p.photoKey}`);
      const validCrop = p.qc?.crop && !p.qcStale;
      return Boolean(s && !validCrop && !isStandardRatio(rotatedSize(s, p.rotation)));
    });

  const visible = onlyBadRatio ? items.filter(hasBadRatio) : items;

  const renderThumb = (item: PhotoQcListItem, p: PhotoQcSlotView) => {
    const key = `${item.reportId}|${p.photoKey}`;
    const s = sizes.current.get(key);
    const validCrop = p.qc?.crop && !p.qcStale ? p.qc.crop : null;
    const bad = s && !validCrop ? !isStandardRatio(rotatedSize(s, p.rotation)) : false;
    const flagged = Boolean(p.qc?.recapture && p.qc.status !== 'RESOLVED');
    return (
      <div key={p.photoKey} className="relative shrink-0" title={p.label}>
        <RotatedPhoto
          url={p.url}
          rotation={p.rotation}
          boxWidth={104}
          boxHeight={78}
          crop={validCrop}
          useThumb
          onSize={(size) => {
            if (!sizes.current.has(key)) {
              sizes.current.set(key, size);
              setSizeTick((n) => n + 1);
            }
          }}
        />
        <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-slate-900/75 text-white text-[9px] font-mono">{p.photoKey}</span>
        {photoKeyOfCover(item) === p.photoKey && <span className="absolute top-0.5 left-0.5 px-1 rounded bg-teal-600 text-white text-[9px] font-bold">Bìa</span>}
        {bad && <span className="absolute top-0.5 right-0.5 px-1 rounded bg-amber-500 text-white text-[9px] font-bold">⚠</span>}
        {flagged && <Flag className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 text-rose-500 drop-shadow" />}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Images className="w-5 h-5 text-teal-600" /> Rà Soát Ảnh Hồ Sơ
          </h2>
          <p className="text-xs text-slate-500">Đổi bìa P04, crop 4:3 / 3:4 không phá ảnh gốc, gắn cờ chụp lại và lập danh sách giao KSV.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exportLevel}
            onChange={(e) => setExportLevel(e.target.value as PhotoQcRecaptureLevel | '')}
            className="px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs cursor-pointer"
          >
            <option value="">Mọi mức thu thập lại</option>
            <option value="OUTDOOR_ONLY">{LEVEL_LABEL.OUTDOOR_ONLY}</option>
            <option value="FULL">{LEVEL_LABEL.FULL}</option>
          </select>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Danh sách giao KSV (.xlsx)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        {isSuperAdmin && !zoneParam && (
          <select value={station} onChange={(e) => setStation(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer">
            <option value="">Mọi ga</option>
            {STATION_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <select value={kind} onChange={(e) => setKind(e.target.value as PhotoQcReportKind | '')} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer">
          <option value="">Mọi loại hồ sơ</option>
          {(Object.keys(KIND_LABEL) as PhotoQcReportKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(Object.keys(FILTER_LABEL) as PhotoQcListFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${filter === f ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600" title="Lọc trong các hồ sơ đã tải">
          <input type="checkbox" checked={onlyBadRatio} onChange={(e) => setOnlyBadRatio(e.target.checked)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
          Sai tỉ lệ
        </label>
        <form
          className="flex items-center gap-1 ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã hồ sơ / mã thửa / mã căn"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-52"
          />
          <button type="submit" className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Search className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => void loadPage(false, null)} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer" title="Tải lại">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}

      <div className="space-y-2">
        {visible.map((item) => {
          const level = item.qc?.recaptureLevel ?? 'NONE';
          const coverOn = item.qc?.coverSource === 'P04';
          const hasP04 = item.pPhotos.some((p) => p.photoKey === 'P-04');
          const busy = savingId === item.reportId;
          return (
            <div key={item.reportId} className={`rounded-xl border bg-white p-3 flex flex-col xl:flex-row gap-3 ${item.qc?.reviewed ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="xl:w-64 shrink-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md border text-[11px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{item.parcelCode || item.reportCode}</span>
                  {item.unitCode && <span className="px-2 py-0.5 rounded-md border text-[11px] bg-indigo-950 text-indigo-300 border-indigo-700 font-mono font-bold">{item.unitCode}</span>}
                  <span className="px-2 py-0.5 rounded-md border text-[11px] bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold">{item.stationCode}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate" title={item.reportCode}>
                  {KIND_LABEL[item.kind]} • {item.status}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.openFlagCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded border text-[10px] bg-rose-950 text-rose-300 border-rose-700 font-bold">{item.openFlagCount} cờ chụp lại</span>
                  )}
                  {item.qc?.reviewed && (
                    <span className="px-1.5 py-0.5 rounded border text-[10px] bg-emerald-950 text-emerald-300 border-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đã rà
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto flex-1 pb-1">
                {item.pPhotos.length === 0 ? <p className="text-xs text-slate-400 self-center">Không có ảnh P.</p> : item.pPhotos.map((p) => renderThumb(item, p))}
              </div>

              <div className="xl:w-72 shrink-0 flex flex-col gap-2 text-xs">
                <label
                  className={`flex items-center gap-2 font-semibold ${item.coverEligible && hasP04 ? 'text-slate-700' : 'text-slate-400'}`}
                  title={!item.coverEligible ? 'Hồ sơ căn hộ giữ bìa cũ' : !hasP04 ? 'Không có ảnh P-04' : ''}
                >
                  <input
                    type="checkbox"
                    checked={coverOn}
                    disabled={!item.coverEligible || !hasP04 || busy}
                    onChange={(e) => void saveRow(item, { coverSource: e.target.checked ? 'P04' : null })}
                    className="w-4 h-4 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
                  />
                  Bìa dùng P-04
                </label>
                <select
                  value={level}
                  disabled={busy}
                  onChange={(e) => void saveRow(item, { recaptureLevel: e.target.value as PhotoQcRecaptureLevel })}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer"
                >
                  {(Object.keys(LEVEL_LABEL) as PhotoQcRecaptureLevel[]).map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABEL[l]}
                      {l === item.suggestedLevel && l !== 'NONE' ? ' (gợi ý)' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(item.reportId)}
                    className="flex-1 px-3 py-1.5 rounded-lg font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
                  >
                    Chi tiết / Crop
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveRow(item, { reviewed: !item.qc?.reviewed })}
                    className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${item.qc?.reviewed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {item.qc?.reviewed ? 'Bỏ đã rà' : 'Đã rà'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && visible.length === 0 && <p className="text-center text-xs text-slate-500 py-10">Không có hồ sơ phù hợp bộ lọc.</p>}

      <div className="flex justify-center">
        {loading ? (
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
          </span>
        ) : (
          cursor && (
            <button
              type="button"
              onClick={() => void loadPage(true, cursor)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Tải thêm {PAGE_SIZE} hồ sơ
            </button>
          )
        )}
      </div>

      {detailId && (
        <PhotoQcDetailModal
          reportId={detailId}
          onClose={() => {
            const id = detailId;
            setDetailId(null);
            void refreshRow(id);
          }}
          onChanged={(id) => void refreshRow(id)}
        />
      )}
    </div>
  );
};
