import React, { useState } from 'react';
import { Crosshair, Edit3, Eye, EyeOff, History, Maximize2, Plus, RotateCw, Undo2 } from 'lucide-react';
import { AuditDefectStrip } from '../../stepwise/ui/AuditDefectStrip';
import { AuditPinBoard, type AuditBoardPin } from '../../stepwise/ui/AuditPinBoard';
import { getOptimisticAddedPhotos, resolveOptimisticPhoto } from '../../stepwise/utils/optimisticPhotoResolver';
import type { CondoDefectItemData } from '../types/condo-audit.types';
import { CondoDefectCard } from './CondoDefectCard';
import { CondoPhotoCard, type CondoPhotoHandlers } from './CondoPhotoCard';

interface CondoDefectStripSectionProps extends CondoPhotoHandlers {
  kind: 'zone' | 'element';
  parentId: string;
  parentCode: string;
  ctxPhotoUrl?: string | null;
  ctxPhotoCode?: string;
  overviewPhotos: string[];
  hasHistory?: boolean;
  historyCount?: number;
  defects: CondoDefectItemData[];
  canEdit: boolean;
  ctxRotation: number;
  onRotateCtx: () => void;
  onAddDefectAt: (x: number, y: number) => void;
  onMoveDefectPin: (defectId: string, x: number, y: number) => void;
  onAddDefect: () => void;
  onDefectFieldChange: (defectId: string, field: keyof CondoDefectItemData, value: unknown, label: string) => void;
  onToggleDeleteDefect: (defect: CondoDefectItemData) => void;
}

/** Phần thân của thẻ Z/E như Nhà dân: dải ảnh tổng quan, rồi dải cuộn ngang gồm ảnh bối cảnh và các thẻ D con. */
export const CondoDefectStripSection: React.FC<CondoDefectStripSectionProps> = ({
  kind,
  parentId,
  parentCode,
  ctxPhotoUrl,
  ctxPhotoCode,
  overviewPhotos,
  hasHistory,
  historyCount,
  defects,
  canEdit,
  ctxRotation,
  onRotateCtx,
  onAddDefectAt,
  onMoveDefectPin,
  onAddDefect,
  onDefectFieldChange,
  onToggleDeleteDefect,
  ...photoHandlers
}) => {
  const { stagedPhotoActions, onUndoPhotoAction, onOpenPhotoZoom, onOpenPhotoAction, onOpenPhotoHistory } = photoHandlers;
  const [showCtxPins, setShowCtxPins] = useState(true);
  const [isPinningCtx, setIsPinningCtx] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);

  const ctxContext = {
    category: 'ZONE_CTX',
    targetPhotoType: 'ZONE_CTX_PHOTO',
    targetPhotoId: parentId,
    zoneCode: parentCode,
  };
  const ctxPhoto = resolveOptimisticPhoto(ctxPhotoUrl || undefined, stagedPhotoActions, ctxContext);
  const ctxUrl = ctxPhoto.status === 'DELETED' ? '' : ctxPhoto.displayUrl;
  const ctxCode = ctxPhotoCode || `${parentCode}-CTX`;
  const ctxTitle = `Ảnh bối cảnh ${parentCode}`;

  // pin_x/pin_y là cột NOT NULL: (0, 0) nghĩa là khuyết tật chưa được ghim, không vẽ lên ảnh
  const defectPins: AuditBoardPin[] = defects.flatMap((defect) =>
    !defect.isDeleted && (defect.pinX || defect.pinY)
      ? [{ code: defect.defectCode, x: Number(defect.pinX), y: Number(defect.pinY) }]
      : []
  );
  const hasPins = defectPins.length > 0 || isPinningCtx;
  const ctxWidthClass = !hasPins
    ? 'w-full sm:w-[calc((100%-2rem)/2.5)] min-w-[260px]'
    : kind === 'zone'
      ? 'w-full lg:w-[65%]'
      : 'w-[85%] sm:w-[68%] lg:w-[62%] min-w-[360px] max-w-[760px]';
  const findDefect = (code: string) => defects.find((defect) => defect.defectCode === code);

  const selectDefectPin = (code: string) => {
    setHighlightedCode(code);
    document
      .getElementById(`condo-defect-${parentCode}-${code}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const badgeColor = kind === 'zone' ? 'sky' : 'amber';
  const overviewContext = {
    category: 'ZONE_OVERVIEW',
    targetPhotoType: 'OVERVIEW',
    targetPhotoId: parentId,
    zoneCode: parentCode,
  };
  const addedOverviews = getOptimisticAddedPhotos(stagedPhotoActions, overviewContext);
  const overviewCount = overviewPhotos.length + addedOverviews.length;

  return (
    <>
      {(overviewCount > 0 || canEdit) && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-700">Ảnh tổng quan ({overviewCount})</span>
          <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2.5 scrollbar-thin">
            {overviewPhotos.map((url, idx) => (
              <div key={url} className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0">
                <CondoPhotoCard
                  {...photoHandlers}
                  {...overviewContext}
                  url={url}
                  photoIndex={idx}
                  photoCode={`${parentCode}-OV-${idx + 1}`}
                  title={`Ảnh tổng quan ${parentCode}`}
                  aspectRatio="h-48"
                  badgeColor={badgeColor}
                />
              </div>
            ))}
            {addedOverviews.map((added, idx) => (
              <div key={added.displayUrl} className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0">
                <CondoPhotoCard
                  {...photoHandlers}
                  {...overviewContext}
                  url={added.displayUrl}
                  photoIndex={overviewPhotos.length + idx}
                  photoCode={`${parentCode}-OV-${overviewPhotos.length + idx + 1}`}
                  title={`Ảnh tổng quan ${parentCode} (Mới thêm)`}
                  aspectRatio="h-48"
                  badgeColor={badgeColor}
                />
              </div>
            ))}
            {canEdit && (
              <div className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0">
                <CondoPhotoCard
                  {...photoHandlers}
                  {...overviewContext}
                  url=""
                  photoIndex={overviewCount}
                  photoCode={`${parentCode}-OV-${overviewCount + 1}`}
                  title="Bổ sung ảnh tổng quan"
                  aspectRatio="h-48"
                  badgeColor={badgeColor}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-700">
            Bối Cảnh ({parentCode}_CTX) &amp; Dải Khuyết Tật D ({defects.length} mục)
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onAddDefect}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Khuyết Tật D</span>
            </button>
          )}
        </div>

        <AuditDefectStrip>
          <div className={`rounded-xl p-3 bg-slate-50 border border-slate-200 flex flex-col space-y-2.5 shrink-0 ${ctxWidthClass}`}>
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <span className="text-[11px] font-black text-slate-800">
                {ctxCode} ({defectPins.length} ghim D)
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {ctxUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCtxPins(!showCtxPins)}
                      title={showCtxPins ? 'Ẩn ghim D' : 'Hiện ghim D'}
                      className="p-1 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      {showCtxPins ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-amber-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPhotoZoom(ctxUrl, ctxTitle, ctxCode, ctxRotation)}
                      title="Phóng to"
                      className="p-1 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </>
                )}
                {hasHistory && onOpenPhotoHistory && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoHistory({
                        photoCode: ctxCode,
                        photoType: 'ZONE_CTX_PHOTO',
                        photoTitle: ctxTitle,
                        currentPhotoUrl: ctxUrl || undefined,
                      })
                    }
                    title={`Lịch sử ảnh (${historyCount ?? 0})`}
                    className="p-1 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    <History className="w-3 h-3" />
                  </button>
                )}
                {canEdit && ctxUrl && (
                  <>
                    <button
                      type="button"
                      onClick={onRotateCtx}
                      title="Xoay 90° và đổi tọa độ ghim D"
                      className="p-1 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPinningCtx(!isPinningCtx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        isPinningCtx
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{isPinningCtx ? 'Đang ghim...' : 'Ghim D'}</span>
                    </button>
                  </>
                )}
                {canEdit && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        ...ctxContext,
                        initialMode: ctxUrl ? 'REPLACE' : 'ADD',
                        currentPhotoUrl: ctxUrl || undefined,
                        currentPhotoCode: ctxCode,
                        photoTitle: ctxTitle,
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{ctxUrl ? 'Đổi CTX' : '+ Thêm CTX'}</span>
                  </button>
                )}
                {ctxPhoto.stagedAction && onUndoPhotoAction && (
                  <button
                    type="button"
                    onClick={() => ctxPhoto.stagedAction && onUndoPhotoAction(ctxPhoto.stagedAction)}
                    className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Hoàn tác ảnh</span>
                  </button>
                )}
              </div>
            </div>
            {ctxUrl ? (
              <AuditPinBoard
                url={ctxUrl}
                alt={ctxTitle}
                rotation={ctxRotation}
                pins={defectPins}
                tone="defect"
                isEditMode={canEdit}
                showPins={showCtxPins}
                isPinning={isPinningCtx}
                selectedCode={highlightedCode}
                maxHeightPx={560}
                onAddAt={(x, y) => {
                  setIsPinningCtx(false);
                  onAddDefectAt(x, y);
                }}
                onMove={(code, x, y) => {
                  const defect = findDefect(code);
                  if (defect) onMoveDefectPin(defect.id, x, y);
                }}
                onSelectPin={selectDefectPin}
                onRemovePin={(code) => {
                  const defect = findDefect(code);
                  if (defect) onToggleDeleteDefect(defect);
                }}
              />
            ) : (
              <div className="h-60 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 italic">
                Chưa có ảnh bối cảnh
              </div>
            )}
          </div>

          {defects.map((defect) => (
            <CondoDefectCard
              key={defect.id}
              {...photoHandlers}
              kind={kind}
              defect={defect}
              parentCode={parentCode}
              isHighlighted={highlightedCode === defect.defectCode}
              onFieldChange={(field, value, label) => onDefectFieldChange(defect.id, field, value, label)}
              onToggleDelete={() => onToggleDeleteDefect(defect)}
            />
          ))}

          {defects.length === 0 && (
            <div className="w-[340px] shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center space-y-2">
              <div className="text-xs font-bold text-slate-600">Chưa ghi nhận khuyết tật D</div>
              {canEdit && (
                <button
                  type="button"
                  onClick={onAddDefect}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Khuyết Tật D</span>
                </button>
              )}
            </div>
          )}
        </AuditDefectStrip>
      </div>
    </>
  );
};
