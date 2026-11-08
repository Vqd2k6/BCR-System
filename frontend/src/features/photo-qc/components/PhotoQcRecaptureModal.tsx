import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Loader2, Printer, X } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { downloadRecaptureList, fetchRecaptureList, type RecaptureListParams } from '../api/photoQc.api';
import type { PhotoQcRecaptureRow } from '../types';
import { KIND_LABEL, LEVEL_LABEL } from '../types';
import { RotatedPhoto } from './RotatedPhoto';

interface PhotoQcRecaptureModalProps {
  zone?: string;
  station?: string;
  onClose: () => void;
}

type LevelFilter = '' | 'OUTDOOR_ONLY' | 'FULL';

/**
 * Xem trước danh sách giao KSV ngay trên màn hình. Bảng và file .xlsx cùng lấy từ một API backend,
 * nên nội dung luôn khớp. Nút In in đúng bảng đang lọc.
 */
export const PhotoQcRecaptureModal: React.FC<PhotoQcRecaptureModalProps> = ({ zone, station, onClose }) => {
  const [level, setLevel] = useState<LevelFilter>('');
  const [rows, setRows] = useState<PhotoQcRecaptureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params: RecaptureListParams = { zone, station, level: level || undefined };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRecaptureList({ zone, station, level: level || undefined }));
    } catch (err: unknown) {
      console.error('[PhotoQc:RecaptureModal.load] Không tải được danh sách giao KSV', err);
      setError(getErrorMessage(err, 'Không tải được danh sách giao KSV'));
    } finally {
      setLoading(false);
    }
  }, [zone, station, level]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadRecaptureList(params);
    } catch (err: unknown) {
      console.error('[PhotoQc:RecaptureModal.download] Không tải được file Excel', err);
      setError(getErrorMessage(err, 'Không tải được file Excel'));
    } finally {
      setDownloading(false);
    }
  };

  // Portal ra body: lớp cha có transform (animate-in) làm position: fixed bám sai khung.
  return createPortal(
    <div className="photo-qc-print-root fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .photo-qc-print-root, .photo-qc-print-root * { visibility: visible !important; }
        .photo-qc-print-root { position: absolute !important; inset: 0 !important; background: none !important; padding: 0 !important; }
        .photo-qc-print-panel { max-height: none !important; box-shadow: none !important; border: 0 !important; }
        .photo-qc-no-print { display: none !important; }
        @page { size: A4 landscape; margin: 10mm; }
        tr { break-inside: avoid; page-break-inside: avoid; }
      }`}</style>
      <div className="photo-qc-print-panel force-light w-full max-w-7xl bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Danh sách giao KSV chụp lại</h3>
          <span className="text-xs text-slate-500">{[station, zone].filter(Boolean).join(' • ') || 'Toàn tuyến'} • {rows.length} hồ sơ</span>
          <div className="photo-qc-no-print ml-auto flex items-center gap-2">
            <select value={level} onChange={(e) => setLevel(e.target.value as LevelFilter)} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer">
              <option value="">Mọi mức (Bên ngoài + Tất cả)</option>
              <option value="OUTDOOR_ONLY">Chỉ {LEVEL_LABEL.OUTDOOR_ONLY}</option>
              <option value="FULL">Chỉ {LEVEL_LABEL.FULL}</option>
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> In
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Tải .xlsx
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {error && <div className="m-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-16">Chưa có hồ sơ nào cần chụp lại.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  {['STT', 'Mã hồ sơ', 'Ga / Zone', 'Loại', 'Địa chỉ', 'Mức', 'Ảnh cần chụp', 'Bìa P-04'].map((h) => (
                    <th key={h} className="text-left font-bold px-3 py-2 border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.reportId} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono font-bold text-slate-800">{r.parcelCode || r.reportCode}</div>
                      {r.unitCode && <div className="font-mono text-indigo-700">{r.unitCode}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.stationCode} • {r.zoneId}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                    <td className="px-3 py-2">{r.address || '---'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded border font-bold ${r.recaptureLevel === 'FULL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                        {LEVEL_LABEL[r.recaptureLevel]}
                      </span>
                      {r.levelIsAuto && <div className="text-[10px] text-slate-400 mt-0.5">tự động</div>}
                      <div className="text-[10px] text-slate-500 mt-0.5">{r.outdoorCount} ngoài • {r.indoorCount} trong</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {r.photos.map((p) => (
                          <div key={p.key} className="w-24">
                            <RotatedPhoto url={p.url} rotation={0} boxWidth={96} boxHeight={72} useThumb />
                            <p className="text-[10px] text-slate-600 line-clamp-2 mt-0.5" title={p.label}>{p.label}</p>
                          </div>
                        ))}
                        {r.photos.length === 0 && <span className="text-slate-400">Theo mức đã chọn (chưa gắn cờ ảnh)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.coverP04 ? 'Có' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
