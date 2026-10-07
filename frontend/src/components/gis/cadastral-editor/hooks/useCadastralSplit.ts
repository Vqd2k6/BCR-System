import { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { api } from '../../../../services/api';
import { GisParcel, MutationPayloadData, CadastralParcelData, SplitChildData, MaxZoneCodeInfo } from '../../shared/types';
import {
  computePolygonAreaM2,
  interpolatePoint,
  splitQuadHorizontal,
  splitQuadVertical,
  cleanPolygonRing,
} from '../../shared/geoMath';

interface UseCadastralSplitProps {
  realActiveCoords: [number, number][];
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  activeParcelId: string;
  totalLandArea: number;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
}

export const useCadastralSplit = ({
  realActiveCoords,
  parcelData,
  parcel,
  activeParcelId,
  totalLandArea,
  boundaryStatus,
  mutationData,
  onMutationDataChange,
}: UseCadastralSplitProps) => {
  const [splitShapeOption, setSplitShapeOption] = useState<'DRAG_HANDLES' | 'CLICK_TO_DRAW'>(
    mutationData.splitShapeOption || 'CLICK_TO_DRAW'
  );
  const [customResidualType, setCustomResidualType] = useState<string>('');
  const [customSplitReason, setCustomSplitReason] = useState<string>('');
  const [dynamicCodes, setDynamicCodes] = useState<string[]>([]);
  const [maxZoneInfo, setMaxZoneInfo] = useState<MaxZoneCodeInfo | null>(null);
  const [_isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);

  const [activeTarget, setActiveTarget] = useState<'A' | 'B'>('A');

  const getDefaultPolygons = useCallback((): { polyA: [number, number][]; polyB: [number, number][] } => {
    return splitQuadHorizontal(realActiveCoords, 0.6);
  }, [realActiveCoords]);

  const [polyAVertices, setPolyAVertices] = useState<[number, number][]>(() => {
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3) {
      return mutationData.splitCustomPointsA;
    }
    return [];
  });

  const [polyBVertices, setPolyBVertices] = useState<[number, number][]>(() => {
    if (mutationData.splitCustomPointsB && mutationData.splitCustomPointsB.length >= 3) {
      return mutationData.splitCustomPointsB;
    }
    return [];
  });

  // Đồng bộ hai chiều khi dữ liệu nháp được nạp từ IndexedDB / Store
  useEffect(() => {
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3) {
      setPolyAVertices(mutationData.splitCustomPointsA);
    }
    if (mutationData.splitCustomPointsB && mutationData.splitCustomPointsB.length >= 3) {
      setPolyBVertices(mutationData.splitCustomPointsB);
    }
  }, [mutationData.splitCustomPointsA, mutationData.splitCustomPointsB]);

  // Tự động khởi tạo cả 2 đa giác A và B ngay khi mở tab Tách thửa để luôn nhìn thấy trên bản đồ
  useEffect(() => {
    const clean = cleanPolygonRing(realActiveCoords);
    if (boundaryStatus === 'SPLIT' && clean.length >= 3) {
      const hasA = polyAVertices.length >= 3 || (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3);
      const hasB = polyBVertices.length >= 3 || (mutationData.splitCustomPointsB && mutationData.splitCustomPointsB.length >= 3);
      if (!hasA || !hasB) {
        const { polyA, polyB } = getDefaultPolygons();
        const finalA = hasA ? (polyAVertices.length >= 3 ? polyAVertices : mutationData.splitCustomPointsA!) : polyA;
        const finalB = hasB ? (polyBVertices.length >= 3 ? polyBVertices : mutationData.splitCustomPointsB!) : polyB;

        setPolyAVertices(finalA);
        setPolyBVertices(finalB);

        onMutationDataChange({
          ...mutationData,
          activeProposalType: 'SPLIT',
          splitCustomPointsA: finalA,
          splitCustomPointsB: finalB,
        });
      }
    }
  }, [boundaryStatus, realActiveCoords, getDefaultPolygons, polyAVertices.length, polyBVertices.length]);

  // Lấy mã dự án mở rộng Max Zone + 1
  useEffect(() => {
    let isMounted = true;
    const fetchCodes = async () => {
      try {
        setIsLoadingCodes(true);
        const resolvedZone = parcel?.zoneId || (parcel as any)?.zone_id || parcelData.zoneId || 'ZONE_01';
        const qParcel = (parcelData.id || activeParcelId) ? `&parcelId=${encodeURIComponent(parcelData.id || activeParcelId)}` : '';
        const qZone = `&zoneId=${encodeURIComponent(resolvedZone)}`;
        const res = await api.get(`/parcels/next-high-range-codes?count=4${qParcel}${qZone}`);
        if (isMounted && res.data?.success && res.data.data?.codes) {
          const codes = res.data.data.codes;
          setDynamicCodes(codes);
          const zoneInfo: MaxZoneCodeInfo = {
            currentMaxCode: res.data.data.currentMaxCode || '',
            nextCode: res.data.data.nextCode || codes[0],
            zoneId: res.data.data.zoneId || resolvedZone,
            mechanism: res.data.data.mechanism || 'MAX_ZONE_PLUS_1',
            description: res.data.data.description,
          };
          setMaxZoneInfo(zoneInfo);

          if (!mutationData.isSubmitted) {
            const currentChildren = mutationData.splitChildren || [];
            const isNewB = mutationData.residualKind === 'NEW_BUILDING';
            const officialCodeB = zoneInfo.nextCode || codes[0] || `${parcelData.projectParcelCode}-B`;

            if (currentChildren.length === 0) {
              const initChildren: SplitChildData[] = [
                {
                  label: `Lô A (Đang KS - ${parcelData.projectParcelCode})`,
                  houseNumber: parcelData.houseNumber,
                  ownerName: parcelData.ownerName || '',
                  suggestedCode: parcelData.projectParcelCode,
                  areaM2: Math.round(totalLandArea * 0.6 * 10) / 10,
                  functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                  isResidualSurplus: false,
                },
                {
                  label: isNewB ? `Lô B (Nhà mới độc lập - ${officialCodeB})` : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: isNewB ? 'Chủ hộ Lô B' : 'Chủ sở hữu phần đất dôi dư',
                  suggestedCode: isNewB ? officialCodeB : `${parcelData.projectParcelCode}-DU`,
                  areaM2: Math.round(totalLandArea * 0.4 * 10) / 10,
                  functionalType: isNewB ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS',
                  residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
                  isResidualSurplus: !isNewB,
                  residualParentParcelCode: parcelData.projectParcelCode,
                  residualParentCadastralCode: parcelData.officialCadastralCode,
                  residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
                  residualMetadataNote: isNewB
                    ? `Nhà mới tách từ ${parcelData.projectParcelCode}`
                    : `Đất thừa tách từ ${parcelData.projectParcelCode}`,
                },
              ];
              onMutationDataChange({
                ...mutationData,
                residualKind: mutationData.residualKind || 'NON_BUILDING',
                splitChildren: initChildren,
              });
            } else {
              const updated = currentChildren.map((c, idx) => {
                if (idx === 0) {
                  return { ...c, suggestedCode: parcelData.projectParcelCode };
                }
                return {
                  ...c,
                  suggestedCode: isNewB ? (officialCodeB || c.suggestedCode) : `${parcelData.projectParcelCode}-DU`,
                  residualKind: (isNewB ? 'NEW_BUILDING' : 'NON_BUILDING') as 'NON_BUILDING' | 'NEW_BUILDING',
                };
              });
              onMutationDataChange({
                ...mutationData,
                splitChildren: updated,
              });
            }
          }
        }
      } catch (_err) {
        const match = parcelData.projectParcelCode.match(/^(.*?)(\d+)$/);
        const prefix = match ? match[1] : 'B-';
        const nextNum = match ? (parseInt(match[2], 10) + 1) : 9999;
        const padLen = match ? Math.max(match[2].length, 4) : 4;
        const fallbackCodes = [
          `${prefix}${String(nextNum).padStart(padLen, '0')}`,
          `${prefix}${String(nextNum + 1).padStart(padLen, '0')}`,
        ];
        if (isMounted) {
          setDynamicCodes(fallbackCodes);
          setMaxZoneInfo({
            currentMaxCode: `${prefix}${String(nextNum - 1).padStart(padLen, '0')}`,
            nextCode: fallbackCodes[0],
            zoneId: parcelData.zoneId || 'ZONE_01',
            mechanism: 'MAX_ZONE_PLUS_1',
          });
        }
      } finally {
        if (isMounted) setIsLoadingCodes(false);
      }
    };

    fetchCodes();
    return () => {
      isMounted = false;
    };
  }, [boundaryStatus, parcelData.projectParcelCode, parcelData.zoneId, parcel, activeParcelId]);

  const calculatedAreaA = useMemo(() => {
    if (polyAVertices.length < 3) return 0;
    const raw = computePolygonAreaM2(polyAVertices);
    if (raw > 0) return raw;
    return Math.round(totalLandArea * 0.6 * 10) / 10;
  }, [polyAVertices, totalLandArea]);

  const calculatedAreaB = useMemo(() => {
    if (polyBVertices.length < 3) {
      if (calculatedAreaA > 0) {
        return Math.max(0.1, Math.round((totalLandArea - calculatedAreaA) * 10) / 10);
      }
      return totalLandArea;
    }
    const raw = computePolygonAreaM2(polyBVertices);
    if (raw > 0) return raw;
    return Math.max(0.1, Math.round((totalLandArea - calculatedAreaA) * 10) / 10);
  }, [polyBVertices, totalLandArea, calculatedAreaA]);

  const syncPolygonsToMutation = useCallback(
    (ptsA: [number, number][], ptsB: [number, number][]) => {
      setPolyAVertices(ptsA);
      setPolyBVertices(ptsB);

      const rawAreaA = computePolygonAreaM2(ptsA);
      const rawAreaB = computePolygonAreaM2(ptsB);
      const validAreaA = rawAreaA > 0 ? rawAreaA : Math.round(totalLandArea * 0.6 * 10) / 10;
      const validAreaB = rawAreaB > 0 ? rawAreaB : Math.max(0.1, Math.round((totalLandArea - validAreaA) * 10) / 10);
      const isNewB = mutationData.residualKind === 'NEW_BUILDING';

      const currentChildren = mutationData.splitChildren || [];
      const child0 = currentChildren[0] || {};
      const child1 = currentChildren[1] || {};

      const updatedChildren: SplitChildData[] = [
        {
          ...child0,
          label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
          houseNumber: parcelData.houseNumber,
          ownerName: parcelData.ownerName || '',
          suggestedCode: parcelData.projectParcelCode,
          areaM2: validAreaA,
          coordinates: ptsA,
          functionalType: child0.functionalType || 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
          isResidualSurplus: false,
        },
        {
          ...child1,
          label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
          houseNumber: child1.houseNumber || `${parcelData.houseNumber}B`,
          ownerName: child1.ownerName || (isNewB ? 'Chủ hộ Căn B' : 'Chủ sở hữu phần đất dôi dư'),
          suggestedCode: isNewB
            ? (dynamicCodes[0] || child1.suggestedCode || `${parcelData.projectParcelCode}-B`)
            : `${parcelData.projectParcelCode}-DU`,
          areaM2: validAreaB,
          coordinates: ptsB,
          functionalType:
            child1.functionalType ||
            (isNewB ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS'),
          residualKind: (isNewB ? 'NEW_BUILDING' : 'NON_BUILDING') as 'NEW_BUILDING' | 'NON_BUILDING',
          isResidualSurplus: !isNewB,
          residualParentParcelCode: parcelData.projectParcelCode,
          residualParentCadastralCode: parcelData.officialCadastralCode,
          residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
          residualMetadataNote: isNewB
            ? `Nhà mới tách từ ${parcelData.projectParcelCode}`
            : `Đất thừa tách từ ${parcelData.projectParcelCode}`,
        },
      ];

      onMutationDataChange({
        ...mutationData,
        splitCustomPointsA: ptsA,
        splitCustomPointsB: ptsB,
        splitChildren: updatedChildren,
        isSubmitted: false,
      });
    },
    [totalLandArea, mutationData, parcelData, dynamicCodes, onMutationDataChange]
  );

  const handleVertexDrag = (index: number, newLatLng: L.LatLng, target: 'A' | 'B' = activeTarget) => {
    if (target === 'A') {
      const updatedA = [...polyAVertices];
      updatedA[index] = [newLatLng.lat, newLatLng.lng];
      syncPolygonsToMutation(updatedA, polyBVertices);
    } else {
      const updatedB = [...polyBVertices];
      updatedB[index] = [newLatLng.lat, newLatLng.lng];
      syncPolygonsToMutation(polyAVertices, updatedB);
    }
  };

  const handleMapClickDraw = (point: [number, number], target: 'A' | 'B' = activeTarget) => {
    if (target === 'A') {
      const updatedA = [...polyAVertices, point];
      syncPolygonsToMutation(updatedA, polyBVertices);
    } else {
      const updatedB = [...polyBVertices, point];
      syncPolygonsToMutation(polyAVertices, updatedB);
    }
  };

  const handleAddMidpoint = (target: 'A' | 'B' = activeTarget) => {
    const list = target === 'A' ? polyAVertices : polyBVertices;
    if (list.length < 2) return;
    const p1 = list[list.length - 1];
    const p2 = list[0];
    const mid = interpolatePoint(p1, p2, 0.5);
    if (target === 'A') {
      syncPolygonsToMutation([...polyAVertices, mid], polyBVertices);
    } else {
      syncPolygonsToMutation(polyAVertices, [...polyBVertices, mid]);
    }
  };

  const handleRemovePoint = (target: 'A' | 'B' = activeTarget) => {
    if (target === 'A') {
      if (polyAVertices.length === 0) return;
      syncPolygonsToMutation(polyAVertices.slice(0, -1), polyBVertices);
    } else {
      if (polyBVertices.length === 0) return;
      syncPolygonsToMutation(polyAVertices, polyBVertices.slice(0, -1));
    }
  };

  const handleResetTarget = (target: 'A' | 'B' = activeTarget) => {
    if (target === 'A') {
      setPolyAVertices([]);
      syncPolygonsToMutation([], polyBVertices);
    } else {
      setPolyBVertices([]);
      syncPolygonsToMutation(polyAVertices, []);
    }
  };

  const handleResetDefault = () => {
    const { polyA, polyB } = getDefaultPolygons();
    syncPolygonsToMutation(polyA, polyB);
  };

  const handleSplitHorizontal = (ratio: number = 0.6) => {
    const { polyA, polyB } = splitQuadHorizontal(realActiveCoords, ratio);
    syncPolygonsToMutation(polyA, polyB);
  };

  const handleSplitVertical = (ratio: number = 0.5) => {
    const { polyA, polyB } = splitQuadVertical(realActiveCoords, ratio);
    syncPolygonsToMutation(polyA, polyB);
  };

  const computePolygonB = useCallback(
    (_ptsA: [number, number][]): [number, number][] => {
      if (polyBVertices.length >= 3) return polyBVertices;
      const { polyB } = splitQuadHorizontal(realActiveCoords, 0.6);
      return polyB;
    },
    [polyBVertices, realActiveCoords]
  );

  return {
    splitShapeOption,
    setSplitShapeOption,
    activeTarget,
    setActiveTarget,
    customResidualType,
    setCustomResidualType,
    customSplitReason,
    setCustomSplitReason,
    dynamicCodes,
    maxZoneInfo,
    polyAVertices,
    setPolyAVertices,
    polyBVertices,
    setPolyBVertices,
    calculatedAreaA,
    calculatedAreaB,
    getDefaultPolygons,
    computePolygonB,
    syncPolygonsToMutation,
    handleVertexDrag,
    handleMapClickDraw,
    handleAddMidpoint,
    handleRemovePoint,
    handleResetTarget,
    handleResetDefault,
    handleSplitHorizontal,
    handleSplitVertical,
  };
};
