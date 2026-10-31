const roundToTenth = (value: number) => Math.round(value * 10) / 10;

export const clampPinCoord = (value: number, min: number, max: number) => roundToTenth(Math.max(min, Math.min(max, value)));

/** Tọa độ % của ghim sau khi xoay ảnh 90° theo chiều kim đồng hồ: (x, y) -> (100 - y, x). */
export function rotatePinCoords(x: number, y: number): { x: number; y: number } {
  return { x: clampPinCoord(100 - y, 1, 99), y: clampPinCoord(x, 1, 99) };
}
