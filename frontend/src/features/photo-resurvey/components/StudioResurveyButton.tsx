import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';
import { fetchResurveyView } from '../api/photoResurvey.api';
import { PhotoResurveyScreen } from './PhotoResurveyScreen';
import { StudioResurveyPanel } from './StudioResurveyPanel';
import type { ResurveySessionView } from '../types';
import { buildStudioResurveyRows } from '../utils/studioResurveyStatus';

interface StudioResurveyButtonProps {
  reportId: string;
  /** Gọi sau khi phiên đổi trạng thái (duyệt / từ chối) để Studio tải lại dữ liệu. */
  onChanged?: () => void;
  /** Báo dữ liệu chụp lại mới nhất lên Studio để thẻ ảnh đổi sang ảnh mới / gắn nhãn. */
  onViewLoaded?: (view: ResurveySessionView | null) => void;
  /** Tăng số để mở panel từ ngoài (hộp thông báo khi mở Studio). */
  openSignal?: number;
}

/**
 * Lối vào ảnh KSV chụp lại trong Studio thẩm định: hiện khi căn có ô cần chụp lại hoặc đã có phiên.
 * Mở panel theo từng ô (cũ – mới – trạng thái); duyệt phiên vẫn ở PhotoResurveyScreen.
 */
export const StudioResurveyButton: React.FC<StudioResurveyButtonProps> = ({ reportId, onChanged, onViewLoaded, openSignal = 0 }) => {
  const [view, setView] = useState<ResurveySessionView | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Giữ callback mới nhất trong ref: Studio truyền hàm mới mỗi lần render, không để nó kích hoạt tải lại.
  const onViewLoadedRef = useRef(onViewLoaded);
  onViewLoadedRef.current = onViewLoaded;

  const load = useCallback(async () => {
    try {
      const next = await fetchResurveyView(reportId);
      setView(next);
      onViewLoadedRef.current?.(next);
    } catch (err: unknown) {
      // Hồ sơ không thuộc diện chụp lại (vd căn hộ): ẩn nút, vẫn log để truy vết.
      console.error('[StudioResurveyButton:load] Không tải được trạng thái ảnh chụp lại', err);
      setView(null);
      onViewLoadedRef.current?.(null);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hộp thông báo của Studio mở panel bằng cách tăng openSignal.
  useEffect(() => {
    if (openSignal > 0) setPanelOpen(true);
  }, [openSignal]);

  const rows = useMemo(() => (view ? buildStudioResurveyRows(view) : []), [view]);
  if (!view || rows.length === 0) return null;

  const ready = rows.filter((r) => r.state === 'READY').length;
  const waiting = rows.filter((r) => r.state === 'SUBMITTED').length;
  const need = rows.filter((r) => r.state === 'NEED' || r.state === 'CAPTURED').length;
  const appliedRows = rows.filter((r) => r.state === 'APPLIED');
  // Đếm theo đúng loại thao tác: thay ảnh / bỏ ô N/A / ảnh thêm (trước đây gộp hết thành "ảnh đã thay").
  const appliedText =
    [
      [appliedRows.filter((r) => r.action === 'REPLACE').length, 'ảnh đã thay'],
      [appliedRows.filter((r) => r.action === 'MARK_NA').length, 'ô bỏ N/A'],
      [appliedRows.filter((r) => r.action === 'ADD_EXTRA').length, 'ảnh thêm'],
    ]
      .filter(([n]) => Number(n) > 0)
      .map(([n, label]) => `${n} ${label}`)
      .join(' · ') || '0 mục đã đưa vào';
  const badge =
    ready > 0
      ? { text: `${ready} ảnh chờ đưa vào`, cls: 'bg-amber-950 text-amber-300 border-amber-700 animate-pulse' }
      : waiting > 0
      ? { text: `${waiting} ảnh chờ duyệt phiên`, cls: 'bg-sky-950 text-sky-300 border-sky-700' }
      : need > 0
      ? { text: `${need} ô chưa có ảnh`, cls: 'bg-rose-950 text-rose-300 border-rose-700' }
      : { text: appliedText, cls: 'bg-emerald-950 text-emerald-300 border-emerald-700' };

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
        title="Xem ô nào cần chụp lại, đã có ảnh mới chưa và ảnh nào đã vào report"
      >
        <Camera className="w-3 h-3 text-sky-600" />
        <span>Ảnh Chụp Lại</span>
        <span className={`px-1.5 py-px rounded-full border text-[10px] ${badge.cls}`}>{badge.text}</span>
      </button>
      {panelOpen &&
        createPortal(
          <StudioResurveyPanel
            view={view}
            onClose={() => setPanelOpen(false)}
            onDecided={(next) => {
              setView(next);
              onViewLoadedRef.current?.(next);
              onChanged?.();
            }}
            onOpenReview={() => {
              setPanelOpen(false);
              setReviewOpen(true);
            }}
          />,
          document.body
        )}
      {reviewOpen &&
        createPortal(
          <PhotoResurveyScreen
            reportId={reportId}
            onClose={() => {
              setReviewOpen(false);
              setPanelOpen(true);
              void load();
            }}
            onChanged={() => {
              void load();
              onChanged?.();
            }}
          />,
          document.body
        )}
    </>
  );
};
