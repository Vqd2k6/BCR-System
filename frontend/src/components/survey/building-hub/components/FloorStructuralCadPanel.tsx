import React, { useMemo, useState } from 'react';
import { Wand2, Crop, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { CadBlueprintUploader } from './CadBlueprintUploader';
import { CadAreaCropModal, type CadCropSource } from '../../../canvas/CadAreaCropModal';
import { cropImageBoundingBox, type UnitPartitionBox } from '../../../canvas/FloorPlanCadPartitionCanvas';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';
import {
  aspectRatioDiff,
  buildCadSheetSources,
  loadImageSize,
  MAIN_E_SOURCE_ID,
  type FloorCadResource,
} from '../../../../core/utils/cadSources';
import { getErrorMessage } from '@/utils/errorUtils';

/** Chênh tỷ lệ khung hình Z/E tối đa cho phép áp nhanh khung (chốt GĐ C: >2% thì chặn) */
const MAX_ASPECT_DIFF = 0.02;
/** Từ mức này trở lên vẫn cho áp nhưng hỏi lại */
const WARN_ASPECT_DIFF = 0.005;

interface FloorStructuralCadPanelProps {
  floorNumber: number;
  floorName: string;
  floorCode: string;
  projectCode: string;
  zCadUrl: string;
  structuralUrl: string;
  /** CAD_E đang lấy theo tầng điển hình gốc (không phải bản vẽ riêng của tầng này) */
  inheritedFromFloor?: number;
  resources: FloorCadResource[];
  partitions: UnitPartitionBox[];
  isLockedBox: (box: UnitPartitionBox) => boolean;
  readOnly?: boolean;
  onChangeStructuralUrl: (url: string | null) => void;
  onChangePartitions: (next: UnitPartitionBox[]) => void;
}

export const FloorStructuralCadPanel: React.FC<FloorStructuralCadPanelProps> = ({
  floorNumber,
  floorName,
  floorCode,
  projectCode,
  zCadUrl,
  structuralUrl,
  inheritedFromFloor,
  resources,
  partitions,
  isLockedBox,
  readOnly = false,
  onChangeStructuralUrl,
  onChangePartitions,
}) => {
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [showReplace, setShowReplace] = useState<boolean>(false);

  const editingBox = partitions.find((p) => p.id === editingBoxId) || null;
  const cropSources = useMemo<CadCropSource[]>(
    () =>
      editingBox
        ? buildCadSheetSources({
            zUrl: zCadUrl,
            eUrl: structuralUrl,
            resources,
            zBbox: { x: editingBox.x, y: editingBox.y, width: editingBox.width, height: editingBox.height },
            eBbox: editingBox.structuralBbox ?? null,
          })
        : [],
    [editingBox, zCadUrl, structuralUrl, resources]
  );

  const eCount = partitions.filter((p) => Boolean(p.unitStructuralCadUrl)).length;

  const handleQuickApply = async () => {
    if (!structuralUrl || !zCadUrl) return;
    const targets = partitions.filter((p) => !isLockedBox(p));
    if (targets.length === 0) {
      alert('Không còn vị trí nào chưa khảo sát để áp khung CAD_E.');
      return;
    }
    setIsApplying(true);
    try {
      const [zSize, eSize] = await Promise.all([loadImageSize(zCadUrl), loadImageSize(structuralUrl)]);
      const diff = aspectRatioDiff(zSize, eSize);
      if (diff > MAX_ASPECT_DIFF) {
        alert(
          `Tỷ lệ khung hình CAD_Z (${zSize.width}×${zSize.height}) và CAD_E (${eSize.width}×${eSize.height}) lệch ${(diff * 100).toFixed(1)}% (> 2%).\n\n` +
            'Không thể áp nhanh vì khung sẽ cắt sai vị trí. Hãy chỉnh khung E từng vị trí bằng nút "Chỉnh khung E".'
        );
        return;
      }
      if (
        diff > WARN_ASPECT_DIFF &&
        !window.confirm(`CAD_Z và CAD_E lệch tỷ lệ ${(diff * 100).toFixed(1)}%. Khung cắt có thể lệch nhẹ. Vẫn áp nhanh cho ${targets.length} vị trí?`)
      ) {
        return;
      }
      const updated: UnitPartitionBox[] = [];
      for (const p of partitions) {
        if (isLockedBox(p)) {
          updated.push(p);
          continue;
        }
        const box = { x: p.x, y: p.y, width: p.width, height: p.height };
        const cropped = await cropImageBoundingBox(structuralUrl, box);
        updated.push({ ...p, structuralBbox: box, unitStructuralCadUrl: cropped });
      }
      onChangePartitions(updated);
    } catch (err) {
      console.error('[FloorStructuralCadPanel:quickApply] Lỗi áp nhanh khung Z → E:', err);
      alert(`Không thể áp nhanh khung Z → E: ${getErrorMessage(err, 'Lỗi tải ảnh CAD')}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (!structuralUrl || showReplace) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {inheritedFromFloor !== undefined && !structuralUrl && (
          <p className="text-xs text-slate-600">Tầng điển hình gốc (Tầng {inheritedFromFloor}) chưa có CAD_E.</p>
        )}
        {readOnly ? (
          <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs text-slate-600">
            Chưa có bản vẽ kết cấu CAD_E cho {floorName}. Vui lòng liên hệ Zone Admin phụ trách.
          </div>
        ) : (
          <>
            <CadBlueprintUploader
              floorNumber={floorNumber}
              floorName={floorName}
              floorCode={floorCode}
              buildingCode={projectCode}
              cadCategory="CAD_E"
              onUploadSuccess={(url) => {
                setShowReplace(false);
                onChangeStructuralUrl(url);
              }}
            />
            {showReplace && (
              <button
                type="button"
                onClick={() => setShowReplace(false)}
                className="text-xs text-slate-600 underline cursor-pointer"
              >
                Hủy đổi CAD_E
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto p-3 bg-slate-100">
        <div className="relative inline-block force-light bg-white border border-slate-200 rounded-xl overflow-hidden">
          <img src={structuralUrl} alt={`CAD_E ${floorName}`} className="block max-w-full" />
          {partitions
            .filter((p) => p.structuralBbox)
            .map((p) => (
              <div
                key={p.id}
                className="absolute border-2 border-indigo-600 bg-indigo-500/10 text-[10px] font-bold text-indigo-900"
                style={{
                  left: `${p.structuralBbox?.x}%`,
                  top: `${p.structuralBbox?.y}%`,
                  width: `${p.structuralBbox?.width}%`,
                  height: `${p.structuralBbox?.height}%`,
                }}
              >
                <span className="px-1 bg-white/80">{formatShortUnitDisplay(p.unitCode, p.partitionType)}</span>
              </div>
            ))}
        </div>
      </div>

      <aside className="w-full lg:w-80 border-l border-slate-200 bg-white flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="text-xs font-bold text-slate-800">
            CAD_E Kết cấu — {eCount}/{partitions.length} vị trí đã cắt
            {inheritedFromFloor !== undefined && (
              <span className="block font-normal text-slate-500">Theo tầng điển hình gốc Tầng {inheritedFromFloor}</span>
            )}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={isApplying || !zCadUrl || partitions.length === 0}
                onClick={() => void handleQuickApply()}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Dùng khung Z của từng vị trí để cắt trên CAD_E (chỉ khi 2 bản vẽ cùng tỷ lệ)"
              >
                <Wand2 className="w-3 h-3" />
                {isApplying ? 'Đang cắt...' : 'Áp nhanh khung Z → E & cắt hàng loạt'}
              </button>
              <button
                type="button"
                onClick={() => setShowReplace(true)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer"
              >
                Đổi CAD_E
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Gỡ CAD_E chính của tầng? Bản vẽ cũ được giữ trong Kho tài nguyên (đã xóa) để truy vết.')) {
                    onChangeStructuralUrl(null);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Gỡ
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {partitions.length === 0 && (
            <p className="text-[11px] text-slate-500 p-2">Chưa có vị trí U/M nào — vẽ phân vùng ở tab CAD_Z trước.</p>
          )}
          {partitions.map((p) => {
            const locked = isLockedBox(p);
            return (
              <div key={p.id} className="p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-slate-800">{p.unitCode}</span>
                  <span className="block text-[10px] text-slate-500 truncate">
                    {p.unitStructuralCadUrl ? (p.structuralBbox ? 'Đã cắt trên CAD_E tầng' : 'Đã gán CAD_E riêng') : 'Chưa có CAD_E'}
                  </span>
                </div>
                {locked ? (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500" title="Đã khảo sát: CAD_E của hồ sơ không bị ghi đè">
                    <Lock className="w-3 h-3" /> Đã khảo sát
                  </span>
                ) : (
                  !readOnly && (
                    <button
                      type="button"
                      onClick={() => setEditingBoxId(p.id)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Crop className="w-3 h-3" /> Chỉnh khung E
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
        {!zCadUrl && (
          <p className="m-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Tầng chưa có CAD_Z nên không thể áp nhanh khung.
          </p>
        )}
      </aside>

      {editingBox && (
        <CadAreaCropModal
          isOpen={Boolean(editingBox)}
          onClose={() => setEditingBoxId(null)}
          cadPhotoUrl={structuralUrl}
          floorName={floorName}
          unitCode={editingBox.unitCode}
          initialBbox={editingBox.structuralBbox ?? null}
          sources={cropSources}
          initialSourceId={MAIN_E_SOURCE_ID}
          onConfirmCrop={(cropped, bbox) => {
            onChangePartitions(
              partitions.map((p) => (p.id === editingBox.id ? { ...p, unitStructuralCadUrl: cropped, structuralBbox: bbox } : p))
            );
          }}
          onConfirmCropFromSource={(cropped, bbox, source) => {
            // Khung chỉ lưu khi cắt trên CAD_E tầng; cắt từ tờ khác thì là CAD_E gán riêng (không có khung E)
            onChangePartitions(
              partitions.map((p) =>
                p.id === editingBox.id
                  ? { ...p, unitStructuralCadUrl: cropped, structuralBbox: source.id === MAIN_E_SOURCE_ID ? bbox : null }
                  : p
              )
            );
          }}
        />
      )}
    </div>
  );
};
