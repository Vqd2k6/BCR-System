import type { DefectItem } from '../../../../../../components/canvas/DefectPinningCanvas';
import { rotatePinCoords } from '../../stepwise/utils/pinCoordinates';
import type { CondoDefectItemData } from '../types/condo-audit.types';

const QUARTER_TURN = 90;
const FULL_TURN = 360;

const isSavedId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
const toCanvasNumber = (value: number | null | undefined): number | '' => value ?? '';
const fromCanvasNumber = (value: number | '' | undefined): number | null => (value === '' || value === undefined ? null : value);

function rotatePin(x: number, y: number, rotation: number): { x: number; y: number } {
  const turns = ((rotation % FULL_TURN) + FULL_TURN) % FULL_TURN / QUARTER_TURN;
  let pin = { x, y };
  for (let i = 0; i < turns; i += 1) pin = rotatePinCoords(pin.x, pin.y);
  return pin;
}

function toActivityState(value: string): DefectItem['activityState'] {
  return value === 'U' || value === 'S' || value === 'A' ? value : '';
}

/** Canvas vẽ ảnh gốc chưa xoay, còn ghim trong Studio lưu theo góc xoay hiện tại của ảnh CTX. */
export function toCanvasDefect(defect: CondoDefectItemData, ctxRotation: number): DefectItem {
  const pin = rotatePin(Number(defect.pinX ?? 0), Number(defect.pinY ?? 0), FULL_TURN - ctxRotation);
  return {
    id: defect.id,
    defectCode: defect.defectCode,
    pinX: pin.x,
    pinY: pin.y,
    screeningCategory: defect.screeningCategory || '',
    defectType: defect.defectType || '',
    crackDirection: defect.crackDirection,
    widthMaxMm: toCanvasNumber(defect.widthMaxMm),
    lengthMm: toCanvasNumber(defect.lengthMm),
    activityState: toActivityState(defect.activityState || ''),
    materialDegradationE4: toCanvasNumber(defect.materialDegradationE4),
    structuralSignificanceE2: toCanvasNumber(defect.structuralSignificanceE2),
    functionalImpactE6: toCanvasNumber(defect.functionalImpactE6),
    hasScaleCard: Boolean(defect.hasScaleCard),
    isStructuralCritical: Boolean(defect.isStructuralCritical),
    cuPhotoUrl: defect.cuPhotoUrl || '',
    cuPhotoCode: defect.cuPhotoCode,
    cuPhotos: defect.cuPhotos || [],
    notes: defect.notes || '',
  };
}

function fromCanvasDefect(
  item: DefectItem,
  existing: CondoDefectItemData | undefined,
  parentCode: string,
  ctxRotation: number
): CondoDefectItemData {
  const pin = rotatePin(item.pinX, item.pinY, ctxRotation);
  const unchangedPin = existing && toCanvasDefect(existing, ctxRotation);
  const isSamePin = unchangedPin?.pinX === item.pinX && unchangedPin?.pinY === item.pinY;
  return {
    ...existing,
    id: existing?.id || `def_${Date.now()}_${item.defectCode}`,
    defectCode: item.defectCode,
    screeningCategory: item.screeningCategory,
    defectType: item.defectType,
    crackDirection: item.crackDirection || '',
    widthMaxMm: fromCanvasNumber(item.widthMaxMm),
    lengthMm: fromCanvasNumber(item.lengthMm),
    activityState: item.activityState,
    materialDegradationE4: fromCanvasNumber(item.materialDegradationE4),
    structuralSignificanceE2: fromCanvasNumber(item.structuralSignificanceE2),
    functionalImpactE6: fromCanvasNumber(item.functionalImpactE6),
    hasScaleCard: item.hasScaleCard,
    isStructuralCritical: item.isStructuralCritical,
    notes: item.notes || '',
    pinX: isSamePin ? existing?.pinX ?? null : pin.x,
    pinY: isSamePin ? existing?.pinY ?? null : pin.y,
    cuPhotoUrl: existing?.cuPhotoUrl ?? null,
    cuPhotos: existing?.cuPhotos ?? [],
    cuPhotoCode: existing?.cuPhotoCode || `${parentCode}-${item.defectCode}-CU`,
  };
}

/**
 * Canvas xóa D khỏi mảng, nhưng D đã lưu là dữ liệu pháp lý nên chỉ được xóa mềm.
 * D tạo mới chưa lưu thì bỏ hẳn. Các D đã xóa mềm từ trước không đi qua canvas nên giữ nguyên.
 */
export function mergeCanvasDefects(
  current: CondoDefectItemData[],
  canvasItems: DefectItem[],
  parentCode: string,
  ctxRotation: number
): CondoDefectItemData[] {
  const activeByCode = new Map(current.filter((d) => !d.isDeleted).map((d) => [d.defectCode, d]));
  const merged = canvasItems.map((item) =>
    fromCanvasDefect(item, activeByCode.get(item.defectCode), parentCode, ctxRotation)
  );
  const keptCodes = new Set(merged.map((d) => d.defectCode));
  const retired = current.flatMap((d) => {
    if (d.isDeleted) return [d];
    if (keptCodes.has(d.defectCode) || !isSavedId(d.id)) return [];
    return [{ ...d, isDeleted: true }];
  });
  return [...merged, ...retired];
}
