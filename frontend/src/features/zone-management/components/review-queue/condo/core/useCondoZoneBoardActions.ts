import { useState } from 'react';
import { getNextAvailablePinCode } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import type { CondoDamageZoneItemData } from '../types/condo-audit.types';
import { compareCodes } from './condo-normalize.utils';
import type { CondoCadBoard } from './useCondoCadPins';

interface UseCondoZoneBoardActionsParams {
  zones: CondoDamageZoneItemData[];
  defaultFloorName: string;
  zoneBoard: CondoCadBoard;
  onChangeZones: (nextZones: CondoDamageZoneItemData[], actionLabel: string) => void;
}

export interface CondoZoneBoardActions {
  highlightedZoneCode: string | null;
  addZone: (cadPosition?: { x: number; y: number }) => void;
  selectZonePin: (code: string) => void;
}

/** Thao tác chung của CAD ở Mục 4.1 và danh sách vùng Z ở Mục 4.2. */
export function useCondoZoneBoardActions({
  zones,
  defaultFloorName,
  zoneBoard,
  onChangeZones,
}: UseCondoZoneBoardActionsParams): CondoZoneBoardActions {
  const [highlightedZoneCode, setHighlightedZoneCode] = useState<string | null>(null);

  const addZone = (cadPosition?: { x: number; y: number }) => {
    const zCode = getNextAvailablePinCode(
      zoneBoard.pins,
      'Z',
      zones.map((z) => z.zoneCode)
    );
    const newZone: CondoDamageZoneItemData = {
      id: `zone_${Date.now()}_${zCode}`,
      zoneCode: zCode,
      floorName: defaultFloorName,
      roomName: '',
      componentType: '',
      wallMaterial: '',
      ctxPhotoUrl: null,
      ctxPhotoCode: `${zCode}-CTX`,
      burlandGrade: 0,
      functionalImpactRepairNeeded: false,
      overviewPhotos: [],
      notes: '',
      defects: [],
    };
    onChangeZones(
      [...zones, newZone].sort((a, b) => compareCodes(a.zoneCode, b.zoneCode)),
      `Thêm mới vùng hư hại ${zCode}`
    );
    if (cadPosition) zoneBoard.addCadPin(zCode, cadPosition.x, cadPosition.y);
  };

  const selectZonePin = (code: string) => {
    setHighlightedZoneCode(code);
    document.getElementById(`condo-zone-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return { highlightedZoneCode, addZone, selectZonePin };
}
