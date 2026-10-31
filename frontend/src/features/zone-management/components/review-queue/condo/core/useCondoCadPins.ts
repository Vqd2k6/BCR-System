import { useCallback, useRef } from 'react';
import type { CadZonePin } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import { useAuditPinUndo, type AuditPinUndo } from '../../stepwise/hooks/useAuditPinUndo';
import { rotatePinCoords } from '../../stepwise/utils/pinCoordinates';

type CondoPinField = 'cadZonePins' | 'cadElementPins' | 'photoRotations';

interface UseCondoCadPinsParams {
  isEditMode: boolean;
  cadUrl: string;
  structuralCadUrl: string;
  cadZonePins: CadZonePin[];
  cadElementPins: CadZonePin[];
  photoRotations: Record<string, number>;
  handleFieldChange: (key: CondoPinField, label: string, val: unknown) => void;
}

export interface CondoCadBoard {
  url: string;
  pins: CadZonePin[];
  rotation: number;
  moveCadPin: (code: string, x: number, y: number) => void;
  addCadPin: (code: string, x: number, y: number) => void;
  rotateCad: () => void;
}

export interface CondoPhotoRotations {
  getRotation: (...keys: string[]) => number;
  setRotation: (key: string, rotation: number) => void;
}

export interface CondoCadPinControls extends CondoPhotoRotations {
  undoState: AuditPinUndo;
  zoneBoard: CondoCadBoard;
  elementBoard: CondoCadBoard;
}

const ZONE_CAD_KEY = 'floor_0_cad';
const ELEMENT_CAD_KEY = 'floor_0_structural_cad';

const pinCode = (pin: CadZonePin) => String(pin.zoneCode || pin.zone_code || '');
const withCoords = (pin: CadZonePin, x: number, y: number): CadZonePin => ({ ...pin, pinX: x, pinY: y, pin_x: x, pin_y: y });

export function getCadPinPosition(pin: CadZonePin): { x: number; y: number } | null {
  const x = pin.pinX ?? pin.pin_x;
  const y = pin.pinY ?? pin.pin_y;
  return x === undefined || x === null || y === undefined || y === null ? null : { x: Number(x), y: Number(y) };
}

/** Dữ liệu và thao tác ghim Z/E trên CAD; dùng ref để hoàn tác luôn áp lên trạng thái mới nhất. */
export function useCondoCadPins({
  isEditMode,
  cadUrl,
  structuralCadUrl,
  cadZonePins,
  cadElementPins,
  photoRotations,
  handleFieldChange,
}: UseCondoCadPinsParams): CondoCadPinControls {
  const undoState = useAuditPinUndo(isEditMode);
  const { pushUndo } = undoState;
  const latestRef = useRef({ cadZonePins, cadElementPins, photoRotations });
  latestRef.current = { cadZonePins, cadElementPins, photoRotations };

  const hasSeparateElementCad = Boolean(structuralCadUrl);

  const setPins = useCallback(
    (field: 'cadZonePins' | 'cadElementPins', pins: CadZonePin[], label: string) => handleFieldChange(field, label, pins),
    [handleFieldChange]
  );

  const setRotation = useCallback(
    (key: string, rotation: number) =>
      handleFieldChange('photoRotations', `Xoay ảnh ${key}`, { ...latestRef.current.photoRotations, [key]: rotation }),
    [handleFieldChange]
  );

  const getRotation = (...keys: string[]) => {
    for (const key of keys) {
      if (photoRotations[key] !== undefined) return Number(photoRotations[key]);
    }
    return 0;
  };

  const moveCadPin = (field: 'cadZonePins' | 'cadElementPins') => (code: string, x: number, y: number) => {
    const update = (nextX: number, nextY: number, label: string) =>
      setPins(
        field,
        latestRef.current[field].map((pin) => (pinCode(pin) === code ? withCoords(pin, nextX, nextY) : pin)),
        label
      );
    const previous = getCadPinPosition(latestRef.current[field].find((pin) => pinCode(pin) === code) || ({} as CadZonePin));
    if (previous) pushUndo(() => update(previous.x, previous.y, `Hoàn tác vị trí ghim ${code}`));
    update(x, y, `Điều chỉnh vị trí ghim ${code} (${x}%, ${y}%)`);
  };

  const addCadPin = (field: 'cadZonePins' | 'cadElementPins') => (code: string, x: number, y: number) => {
    const isZone = field === 'cadZonePins';
    const pin = {
      id: `pin-${isZone ? 'z' : 'e'}-${Date.now()}`,
      zoneCode: code,
      label: code,
      type: isZone ? 'ZONE' : 'STRUCTURAL',
      pinX: x,
      pinY: y,
      pin_x: x,
      pin_y: y,
    } as CadZonePin;
    setPins(field, [...latestRef.current[field], pin], `Thêm ghim ${code} tại (${x}%, ${y}%)`);
  };

  /** Hai nhóm ghim dùng chung một CAD thì xoay cùng nhau, CAD E riêng chỉ xoay ghim E. */
  const rotateCad = (isElementBoard: boolean) => {
    const rotatesElementCadOnly = isElementBoard && hasSeparateElementCad;
    const key = rotatesElementCadOnly ? ELEMENT_CAD_KEY : ZONE_CAD_KEY;
    const current = getRotation(key);
    const fields: Array<'cadZonePins' | 'cadElementPins'> = rotatesElementCadOnly
      ? ['cadElementPins']
      : hasSeparateElementCad
        ? ['cadZonePins']
        : ['cadZonePins', 'cadElementPins'];
    const previous = fields.map((field) => ({ field, pins: latestRef.current[field] }));

    setRotation(key, (current + 90) % 360);
    for (const { field, pins } of previous) {
      setPins(
        field,
        pins.map((pin) => {
          const position = getCadPinPosition(pin);
          if (!position) return pin;
          const next = rotatePinCoords(position.x, position.y);
          return withCoords(pin, next.x, next.y);
        }),
        `Xoay CAD 90° và đổi tọa độ ghim`
      );
    }
    pushUndo(() => {
      setRotation(key, current);
      previous.forEach(({ field, pins }) => setPins(field, pins, 'Hoàn tác xoay CAD'));
    });
  };

  return {
    undoState,
    getRotation,
    setRotation,
    zoneBoard: {
      url: cadUrl,
      pins: cadZonePins,
      rotation: getRotation(ZONE_CAD_KEY),
      moveCadPin: moveCadPin('cadZonePins'),
      addCadPin: addCadPin('cadZonePins'),
      rotateCad: () => rotateCad(false),
    },
    elementBoard: {
      url: structuralCadUrl || cadUrl,
      pins: cadElementPins,
      rotation: getRotation(hasSeparateElementCad ? ELEMENT_CAD_KEY : ZONE_CAD_KEY),
      moveCadPin: moveCadPin('cadElementPins'),
      addCadPin: addCadPin('cadElementPins'),
      rotateCad: () => rotateCad(true),
    },
  };
}
