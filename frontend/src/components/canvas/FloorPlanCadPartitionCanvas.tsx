import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Square,
  Trash2,
  CheckCircle2,
  Hand,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Home,
  Building2,
} from 'lucide-react';
import { useInteractiveCanvasZoom } from './useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from './CanvasZoomToolbar';
import { getSafeDisplayUrl, resolveOfflinePhotoUrl } from '../../core/storage/offlinePhotoStorage';
import { formatShortUnitDisplay, generateNextPartitionCode } from '../../core/utils/codeFormattingUtils';
import { CadPartitionListSidebar } from './CadPartitionListSidebar';

export interface BuildingUnitReference {
  id?: string;
  unit_code?: string;
  unitCode?: string;
  floor_number?: number;
  floorNumber?: number;
  unit_type?: 'UNIT' | 'MASTER';
  unitType?: 'UNIT' | 'MASTER';
  status?: string;
  phase1_report_id?: string | null;
}

export interface UnitPartitionBox {
  id: string;
  unitCode: string; // VD: "U-001" hoặc "M-001"
  displayCode?: string; // Mã hiển thị nhanh: "U-001" hoặc "M-001"
  partitionType?: 'UNIT' | 'MASTER';
  x: number; // 0..100% (tỷ lệ chuẩn hóa)
  y: number; // 0..100%
  width: number; // 0..100%
  height: number; // 0..100%
  polygon?: { x: number; y: number }[];
  unitCadUrl?: string; // Data URL hoặc photo URL sau khi crop
}

interface Props {
  cadPhotoUrl: string;
  floorNumber: number;
  floorCode?: string;
  projectParcelCode?: string;
  initialPartitions?: UnitPartitionBox[];
  onChangePartitions?: (partitions: UnitPartitionBox[]) => void;
  onSave?: (partitions: UnitPartitionBox[]) => void;
  onValidationChange?: (isValid: boolean) => void;
  readOnly?: boolean;
  allBuildingUnits?: BuildingUnitReference[];
}

/**
 * Hàm crop một vùng chữ nhật từ ảnh gốc bằng HTML5 Canvas ngầm (Offscreen Canvas)
 */
export async function cropImageBoundingBox(
  imageSrc: string,
  box: { x: number; y: number; width: number; height: number },
  paddingPercent: number = 0.05
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Tính padding (mở rộng 5% mỗi chiều để thấy viền tường xung quanh)
      const padW = box.width * paddingPercent;
      const padH = box.height * paddingPercent;

      const normX = Math.max(0, box.x - padW);
      const normY = Math.max(0, box.y - padH);
      const normW = Math.min(100 - normX, box.width + padW * 2);
      const normH = Math.min(100 - normY, box.height + padH * 2);

      const srcX = (normX / 100) * origW;
      const srcY = (normY / 100) * origH;
      const srcW = (normW / 100) * origW;
      const srcH = (normH / 100) * origH;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(100, Math.round(srcW));
      canvas.height = Math.max(100, Math.round(srcH));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Nền trắng rõ nét
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(croppedDataUrl);
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

export const FloorPlanCadPartitionCanvas: React.FC<Props> = ({
  cadPhotoUrl,
  floorNumber,
  floorCode,
  projectParcelCode,
  initialPartitions = [],
  onChangePartitions,
  onSave: _onSave,
  onValidationChange,
  readOnly = false,
  allBuildingUnits = [],
}) => {
  const [partitions, setPartitions] = useState<UnitPartitionBox[]>(initialPartitions);
  const [activeTool, setActiveTool] = useState<'DRAW_UNIT' | 'DRAW_MASTER' | 'PAN'>(readOnly ? 'PAN' : 'DRAW_UNIT');
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showUnitList, setShowUnitList] = useState<boolean>(true);
  const [safeCadUrl, setSafeCadUrl] = useState<string>(() => getSafeDisplayUrl(cadPhotoUrl));

  useEffect(() => {
    if (readOnly) {
      setActiveTool('PAN');
    }
  }, [readOnly]);

  // State cho việc kéo vẽ ô chữ nhật mới
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;
    if (cadPhotoUrl) {
      resolveOfflinePhotoUrl(cadPhotoUrl).then((resolved) => {
        if (isSubscribed && resolved) setSafeCadUrl(resolved);
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [cadPhotoUrl]);

  useEffect(() => {
    setPartitions(initialPartitions || []);
  }, [initialPartitions]);

  // Hook tương tác Zoom & Pan
  const {
    zoomScale,
    containerRef,
    tightBoxRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
    calculateNormalizedCoords,
    transformStyle,
    pinCounterScale,
  } = useInteractiveCanvasZoom();

  // Tìm các căn đã được khảo sát trên tầng hiện tại để khóa không cho sửa đổi mã (Bảo vệ tính bất biến pháp lý)
  const surveyedUnitIds = useMemo(() => {
    const set = new Set<string>();
    (allBuildingUnits || []).forEach((u) => {
      const uFl = u.floor_number ?? u.floorNumber ?? 1;
      if (uFl === floorNumber) {
        const isSurveyed = u.status && u.status !== 'NOT_SURVEYED';
        const hasReport = Boolean(u.phase1_report_id);
        if (isSurveyed || hasReport) {
          if (u.id) set.add(u.id);
          const c = (u.unit_code || u.unitCode || '').trim().toLowerCase();
          if (c) set.add(c);
        }
      }
    });
    return set;
  }, [allBuildingUnits, floorNumber]);

  // Kiểm tra trùng lặp hoặc để trống mã căn (bao gồm cả các tầng khác trong tòa nhà)
  const { duplicateBoxIds, duplicateErrors } = useMemo(() => {
    const counts = new Map<string, number>();
    partitions.forEach((p) => {
      const code = p.unitCode.trim().toLowerCase();
      if (code) {
        counts.set(code, (counts.get(code) || 0) + 1);
      }
    });

    const otherFloorsCodeMap = new Map<string, number>();
    (allBuildingUnits || []).forEach((u) => {
      const uFl = u.floor_number ?? u.floorNumber ?? 1;
      if (uFl !== floorNumber) {
        const c = (u.unit_code || u.unitCode || '').trim().toLowerCase();
        if (c) {
          otherFloorsCodeMap.set(c, uFl);
        }
      }
    });

    const ids = new Set<string>();
    const errors = new Map<string, string>();

    partitions.forEach((p) => {
      const code = p.unitCode.trim().toLowerCase();
      if (!code) {
        ids.add(p.id);
        errors.set(p.id, 'Chưa đặt mã vị trí');
      } else if ((counts.get(code) || 0) > 1) {
        ids.add(p.id);
        errors.set(p.id, 'Trùng mã trên tầng này');
      } else if (otherFloorsCodeMap.has(code)) {
        ids.add(p.id);
        const conflictFloor = otherFloorsCodeMap.get(code);
        errors.set(p.id, `Trùng mã ở Tầng ${conflictFloor}`);
      }
    });
    return { duplicateBoxIds: ids, duplicateErrors: errors };
  }, [partitions, allBuildingUnits, floorNumber]);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(duplicateBoxIds.size === 0);
    }
  }, [duplicateBoxIds, onValidationChange]);

  // Thống kê phân chia theo loại căn hộ / master area
  const floorScopeSummary = useMemo(() => {
    const unitCount = partitions.filter((p) => (p.partitionType || 'UNIT') === 'UNIT').length;
    const masterCount = partitions.filter((p) => p.partitionType === 'MASTER').length;
    let scope: 'UNIT' | 'MASTER' | 'BOTH' | 'EMPTY' = 'EMPTY';
    if (unitCount > 0 && masterCount > 0) scope = 'BOTH';
    else if (masterCount > 0) scope = 'MASTER';
    else if (unitCount > 0) scope = 'UNIT';
    return { unitCount, masterCount, scope };
  }, [partitions]);

  // Tổng hợp danh sách căn hộ / master toàn tòa nhà (các tầng khác + canvas hiện tại)
  const combinedBuildingUnits = useMemo(() => {
    const otherUnits = (allBuildingUnits || []).filter((u) => {
      const uFl = u.floor_number ?? u.floorNumber ?? 1;
      return uFl !== floorNumber;
    });

    return [
      ...otherUnits.map((u) => ({
        unitCode: u.unit_code || u.unitCode || '',
        partitionType: (u.unit_type || u.unitType || 'UNIT') as 'UNIT' | 'MASTER',
      })),
      ...partitions.map((p) => ({
        unitCode: p.unitCode,
        partitionType: (p.partitionType || 'UNIT') as 'UNIT' | 'MASTER',
      })),
    ];
  }, [allBuildingUnits, floorNumber, partitions]);

  // Sinh mã tiếp theo cho Căn hộ con (U-XXX tăng dần toàn tòa)
  const getNextUnitCode = useCallback((): string => {
    return generateNextPartitionCode(combinedBuildingUnits, 'UNIT');
  }, [combinedBuildingUnits]);

  // Sinh mã tiếp theo cho Khu vực Dùng chung (M-XXX tăng dần toàn tòa)
  const getNextMasterCode = useCallback((): string => {
    return generateNextPartitionCode(combinedBuildingUnits, 'MASTER');
  }, [combinedBuildingUnits]);

  // Bắt đầu kéo vẽ ô hoặc di chuyển
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.button === 1 || e.buttons === 4) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (activeTool === 'DRAW_UNIT' || activeTool === 'DRAW_MASTER') {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        isDrawingRef.current = true;
        setDragStart(coords);
        setCurrentDrag(coords);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.buttons === 4) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    if (isDrawingRef.current && dragStart) {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        setCurrentDrag(coords);
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.buttons === 4) {
      endPan();
      return;
    }

    if (isDrawingRef.current && dragStart && currentDrag) {
      isDrawingRef.current = false;

      const minX = Math.min(dragStart.x, currentDrag.x);
      const maxX = Math.max(dragStart.x, currentDrag.x);
      const minY = Math.min(dragStart.y, currentDrag.y);
      const maxY = Math.max(dragStart.y, currentDrag.y);

      const width = maxX - minX;
      const height = maxY - minY;

      // Chỉ chấp nhận nếu kích thước ô kéo vẽ lớn hơn 1.5% chiều rộng/chiều cao
      if (width >= 1.5 && height >= 1.5) {
        const isMaster = activeTool === 'DRAW_MASTER';
        const nextCode = isMaster ? getNextMasterCode() : getNextUnitCode();
        const newBox: UnitPartitionBox = {
          id: `unit_box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          unitCode: nextCode,
          displayCode: nextCode,
          partitionType: isMaster ? 'MASTER' : 'UNIT',
          x: Math.round(minX * 10) / 10,
          y: Math.round(minY * 10) / 10,
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10,
        };

        // Tự động tạo ảnh crop ngầm cho vùng này
        try {
          const cropped = await cropImageBoundingBox(safeCadUrl || cadPhotoUrl, newBox);
          newBox.unitCadUrl = cropped;
        } catch (cropErr: unknown) {
          console.warn('[FloorPlanCad:cropBoundingBox] Không thể crop ảnh vùng mới vẽ:', cropErr);
        }

        const updated = [...partitions, newBox];
        setPartitions(updated);
        setSelectedBoxId(newBox.id);
        if (onChangePartitions) onChangePartitions(updated);
      }

      setDragStart(null);
      setCurrentDrag(null);
    }
  };

  const handleDeleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = partitions.filter((p) => p.id !== id);
    setPartitions(updated);
    if (selectedBoxId === id) setSelectedBoxId(null);
    if (onChangePartitions) onChangePartitions(updated);
  };

  const handleRenameBox = (id: string, newCode: string) => {
    const updated = partitions.map((p) => (p.id === id ? { ...p, unitCode: newCode } : p));
    setPartitions(updated);
    if (onChangePartitions) onChangePartitions(updated);
  };

  const handleTogglePartitionType = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = partitions.map((p) => {
      if (p.id === id) {
        const nextType: 'UNIT' | 'MASTER' = (p.partitionType || 'UNIT') === 'UNIT' ? 'MASTER' : 'UNIT';
        let newCode = p.unitCode;
        if (nextType === 'MASTER' && /^U[-_]\d+$/i.test(p.unitCode.trim())) {
          newCode = generateNextPartitionCode(combinedBuildingUnits, 'MASTER');
        } else if (nextType === 'UNIT' && /^M[-_]\d+$/i.test(p.unitCode.trim())) {
          newCode = generateNextPartitionCode(combinedBuildingUnits, 'UNIT');
        }
        return { ...p, partitionType: nextType, unitCode: newCode, displayCode: newCode };
      }
      return p;
    });
    setPartitions(updated);
    if (onChangePartitions) onChangePartitions(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-xl select-none">
      {/* 1. Header Toolbar (Light Theme) */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 text-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-200">
            <Square className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              Chia Cắt Mặt Bằng CAD
              {projectParcelCode && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300 font-bold shadow-2xs" title="Mã định danh thửa đất / tòa nhà">
                  {projectParcelCode}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold">
                Tầng {floorNumber} {floorCode ? `(${floorCode})` : ''}
              </span>
              {floorScopeSummary.unitCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  {floorScopeSummary.unitCount} Căn Hộ
                </span>
              )}
              {floorScopeSummary.masterCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {floorScopeSummary.masterCount} Khu Vực Master
                </span>
              )}
              {floorScopeSummary.scope === 'BOTH' && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Hỗn hợp
                </span>
              )}
              {duplicateBoxIds.size > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  {duplicateBoxIds.size} vị trí trùng/thiếu mã
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              Chọn công cụ bên phải và kéo chuột tạo ô: <strong className="text-teal-700 font-bold">Căn hộ</strong> (xanh ngọc) hoặc <strong className="text-indigo-700 font-bold">Khu vực dùng chung</strong> (chàm)
            </p>
          </div>
        </div>

        {/* Chuyển đổi công cụ & Hiển thị */}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTool('DRAW_UNIT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  activeTool === 'DRAW_UNIT'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Vẽ căn hộ con riêng lẻ (Teal)"
              >
                <Home className="w-3.5 h-3.5" />
                Vẽ Căn Hộ
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('DRAW_MASTER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  activeTool === 'DRAW_MASTER'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Vẽ khu vực dùng chung của toà mẹ: Hầm, sảnh, mái, kỹ thuật (Indigo)"
              >
                <Building2 className="w-3.5 h-3.5" />
                Vẽ Khu Chung
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('PAN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  activeTool === 'PAN'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Cuộn / Di chuyển góc nhìn"
              >
                <Hand className="w-3.5 h-3.5" />
                Di Chuyển
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`p-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
              showBoxes
                ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-2xs'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title={showBoxes ? 'Ẩn các ô phân chia' : 'Hiện các ô phân chia'}
          >
            {showBoxes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowUnitList(!showUnitList)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              showUnitList
                ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-2xs'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title={showUnitList ? 'Ẩn danh sách phân chia' : 'Hiện danh sách phân chia'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DS Vị Trí ({partitions.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area: Split Canvas + Unit List Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative flex-1 overflow-hidden bg-slate-200/70 flex items-center justify-center ${
            readOnly || activeTool === 'PAN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
        >
          <div
            ref={tightBoxRef}
            style={transformStyle}
            className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
          >
            {/* Ảnh CAD Mặt Bằng Toàn Tầng */}
            <img
              src={safeCadUrl || cadPhotoUrl}
              alt={`Mặt bằng Tầng ${floorNumber}`}
              draggable={false}
              className="block max-w-full max-h-[70vh] sm:max-h-[78vh] object-contain pointer-events-none select-none rounded-lg bg-white shadow-md border border-slate-300"
            />

            {/* Lớp các ô phân chia căn hộ / khu vực đã vẽ */}
            {showBoxes &&
              partitions.map((box) => {
                const isSelected = selectedBoxId === box.id;
                const isDuplicate = duplicateBoxIds.has(box.id);
                const isMaster = box.partitionType === 'MASTER';
                return (
                  <div
                    key={box.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBoxId(box.id);
                    }}
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                    className={`absolute rounded-md border-2 cursor-pointer flex flex-col justify-between p-1 select-none overflow-hidden ${
                      isDuplicate
                        ? 'border-rose-500 bg-rose-500/25 ring-2 ring-rose-400/60 z-25'
                        : isSelected
                        ? 'border-amber-500 bg-amber-400/30 ring-2 ring-amber-400/60 z-20 shadow-md'
                        : isMaster
                        ? 'border-indigo-600 bg-indigo-500/25 hover:bg-indigo-500/35 z-10'
                        : 'border-teal-500 bg-teal-500/20 hover:bg-teal-500/30 z-10'
                    }`}
                  >
                    {/* Badge số căn mm.nn hoặc vị trí master */}
                    <div className="flex items-center justify-between gap-1 max-w-full overflow-hidden">
                      <span
                        style={{ transform: `scale(${pinCounterScale})`, transformOrigin: 'top left' }}
                        title={box.unitCode ? `Mã vị trí ngầm: ${box.unitCode}` : 'Chưa đặt mã'}
                        className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] sm:text-xs shadow-sm flex items-center gap-1 max-w-full truncate ${
                          isDuplicate
                            ? 'bg-rose-600 text-white border border-rose-700'
                            : isMaster
                            ? 'bg-indigo-900 text-white border border-indigo-700'
                            : 'bg-white/95 text-slate-900 border border-teal-600 backdrop-blur-xs'
                        }`}
                      >
                        {isMaster ? <Building2 className="w-2.5 h-2.5 inline shrink-0" /> : <Home className="w-2.5 h-2.5 inline shrink-0" />}
                        <span className="truncate">{formatShortUnitDisplay(box.unitCode, box.partitionType) || 'Chưa đặt mã'}</span>
                      </span>
                      {!readOnly && isSelected && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBox(box.id, e)}
                          className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-transform hover:scale-110 cursor-pointer shrink-0"
                          title="Xóa ô này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Icon crop status & error */}
                    <div className="flex justify-end gap-1 items-center">
                      {isDuplicate && (
                        <span className="text-[9px] font-bold px-1 rounded bg-rose-600 text-white">
                          Trùng
                        </span>
                      )}
                      {box.unitCadUrl && (
                        <span className={`text-[9px] font-bold px-1 rounded text-white ${isMaster ? 'bg-indigo-700' : 'bg-teal-700'}`}>
                          CAD ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Preview ô đang kéo vẽ dở (Không animate-pulse để tránh nhấp nháy/giật kích thước) */}
            {!readOnly && dragStart && currentDrag && (
              <div
                style={{
                  left: `${Math.min(dragStart.x, currentDrag.x)}%`,
                  top: `${Math.min(dragStart.y, currentDrag.y)}%`,
                  width: `${Math.abs(currentDrag.x - dragStart.x)}%`,
                  height: `${Math.abs(currentDrag.y - dragStart.y)}%`,
                }}
                className={`absolute border-2 border-dashed rounded-md pointer-events-none z-30 overflow-hidden ${
                  activeTool === 'DRAW_MASTER'
                    ? 'border-indigo-600 bg-indigo-500/20'
                    : 'border-teal-500 bg-teal-500/20'
                }`}
              >
                <div className="p-1 max-w-full overflow-hidden">
                  <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-white shadow-xs flex items-center gap-1 w-fit max-w-full truncate ${
                    activeTool === 'DRAW_MASTER' ? 'bg-indigo-600' : 'bg-teal-600'
                  }`}>
                    {activeTool === 'DRAW_MASTER' ? <Building2 className="w-2.5 h-2.5 inline shrink-0" /> : <Home className="w-2.5 h-2.5 inline shrink-0" />}
                    <span className="truncate">{formatShortUnitDisplay(activeTool === 'DRAW_MASTER' ? getNextMasterCode() : getNextUnitCode(), activeTool === 'DRAW_MASTER' ? 'MASTER' : 'UNIT')}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Floating Zoom Toolbar */}
          <div className="absolute bottom-4 right-4 z-40">
            <CanvasZoomToolbar
              zoomScale={zoomScale}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onSelectPreset={handleSetZoomPreset}
            />
          </div>
        </div>

        {/* Right Unit List Panel (Light Theme, no layout jump) */}
        {showUnitList && (
          <CadPartitionListSidebar
            floorNumber={floorNumber}
            floorCode={floorCode}
            projectParcelCode={projectParcelCode}
            partitions={partitions}
            selectedBoxId={selectedBoxId}
            setSelectedBoxId={setSelectedBoxId}
            duplicateBoxIds={duplicateBoxIds}
            duplicateErrors={duplicateErrors}
            surveyedUnitIds={surveyedUnitIds}
            readOnly={readOnly}
            onRenameBox={handleRenameBox}
            onDeleteBox={handleDeleteBox}
            onTogglePartitionType={handleTogglePartitionType}
          />
        )}
      </div>
    </div>
  );
};

