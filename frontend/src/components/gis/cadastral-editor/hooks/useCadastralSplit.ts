import { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { api } from '../../../../services/api';
import { GisParcel, MutationPayloadData, CadastralParcelData, SplitChildData, MaxZoneCodeInfo } from '../../shared/types';
import { computePolygonAreaM2, interpolatePoint, splitQuadHorizontal, splitQuadVertical } from '../../shared/geoMath';

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

  const getDefaultPolygonA = useCallback((): [number, number][] => {
    if (realActiveCoords.length < 3) return realActiveCoords;
    const p0 = realActiveCoords[0];
    const p1 = realActiveCoords[1];
    const p2 = realActiveCoords[2];
    const p3 = realActiveCoords[3] || realActiveCoords[2];

    const cutL = interpolatePoint(p0, p3, 0.6);
    const cutR = interpolatePoint(p1, p2, 0.6);
    return [p0, p1, cutR, cutL];
  }, [realActiveCoords]);

  const getLShapePolygon = useCallback((): [number, number][] => {
    if (realActiveCoords.length < 3) return realActiveCoords;
    const p0 = realActiveCoords[0];
    const p1 = realActiveCoords[1];
    const p2 = realActiveCoords[2];
    const p3 = realActiveCoords[3] || realActiveCoords[2];

    const cutL = interpolatePoint(p0, p3, 0.65);
    const cutR = interpolatePoint(p1, p2, 0.65);
    const cornerPoint = interpolatePoint(cutL, cutR, 0.6);
    const frontCut = interpolatePoint(p0, p1, 0.6);

    return [p0, frontCut, cornerPoint, cutR, p2, p3];
  }, [realActiveCoords]);

  const [polyAVertices, setPolyAVertices] = useState<[number, number][]>(() => {
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3) {
      return mutationData.splitCustomPointsA;
    }
    return [];
  });

  // Đồng bộ hai chiều khi dữ liệu nháp được nạp từ IndexedDB / Store
  useEffect(() => {
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3) {
      setPolyAVertices(mutationData.splitCustomPointsA);
    }
  }, [mutationData.splitCustomPointsA]);

  // Tự động khởi tạo cả 2 đa giác A và B ngay khi mở tab Tách thửa để luôn nhìn thấy trên bản đồ
  useEffect(() => {
    if (boundaryStatus === 'SPLIT' && polyAVertices.length < 3 && realActiveCoords.length >= 3) {
      if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length >= 3) {
        setPolyAVertices(mutationData.splitCustomPointsA);
        return;
      }
      const def = getDefaultPolygonA();
      setPolyAVertices(def);
      const p0 = realActiveCoords[0];
      const p1 = realActiveCoords[1];
      const p2 = realActiveCoords[2];
      const p3 = realActiveCoords[3] || realActiveCoords[2];
      const cutL = def[3] || interpolatePoint(p0, p3, 0.6);
      const cutR = def[2] || interpolatePoint(p1, p2, 0.6);
      const polyB: [number, number][] = [cutL, cutR, p2, p3];

      onMutationDataChange({
        ...mutationData,
        activeProposalType: 'SPLIT',
        splitCustomPointsA: def,
        splitCustomPointsB: polyB,
      });
    }
  }, [boundaryStatus, polyAVertices.length, realActiveCoords, getDefaultPolygonA, mutationData.splitCustomPointsA]);

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
    if (polyAVertices.length < 3) {
      return 0;
    }
    const raw = computePolygonAreaM2(polyAVertices);
    if (raw > 0 && raw < totalLandArea) return raw;
    return Math.round(totalLandArea * 0.6 * 10) / 10;
  }, [polyAVertices, totalLandArea]);

  const calculatedAreaB = useMemo(() => {
    if (calculatedAreaA <= 0) return totalLandArea;
    return Math.max(0.1, Math.round((totalLandArea - calculatedAreaA) * 10) / 10);
  }, [totalLandArea, calculatedAreaA]);

  const computePolygonB = useCallback(
    (ptsA: [number, number][]): [number, number][] => {
      if (realActiveCoords.length < 3) return realActiveCoords;
      if (ptsA.length >= 4) {
        const p0 = realActiveCoords[0];
        const p1 = realActiveCoords[1];
        const p2 = realActiveCoords[2];
        const p3 = realActiveCoords[3] || realActiveCoords[2];
        const cutR = ptsA[2] || interpolatePoint(p1, p2, 0.6);
        const cutL = ptsA[3] || interpolatePoint(p0, p3, 0.6);
        if (realActiveCoords.length <= 4) {
          return [cutL, cutR, p2, p3];
        }
        const remaining = realActiveCoords.slice(2, realActiveCoords.length - 1);
        const last = realActiveCoords[realActiveCoords.length - 1];
        return [cutL, cutR, ...remaining, last];
      }
      return realActiveCoords;
    },
    [realActiveCoords]
  );

  const updateVerticesAndSync = useCallback(
    (updatedA: [number, number][]) => {
      setPolyAVertices(updatedA);
      const polyB = computePolygonB(updatedA);
      const rawAreaA = computePolygonAreaM2(updatedA);
      const validAreaA =
        rawAreaA > 0 && rawAreaA < totalLandArea
          ? rawAreaA
          : Math.round(totalLandArea * 0.6 * 10) / 10;
      const validAreaB = Math.max(0.1, Math.round((totalLandArea - validAreaA) * 10) / 10);
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
          coordinates: updatedA,
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
          coordinates: polyB,
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
        splitCustomPointsA: updatedA,
        splitCustomPointsB: polyB,
        splitChildren: updatedChildren,
        isSubmitted: false,
      });
    },
    [computePolygonB, totalLandArea, mutationData, parcelData, dynamicCodes, onMutationDataChange]
  );

  const handleVertexDrag = (index: number, newLatLng: L.LatLng) => {
    const updated = [...polyAVertices];
    updated[index] = [newLatLng.lat, newLatLng.lng];
    updateVerticesAndSync(updated);
  };

  const handleMapClickDraw = (point: [number, number]) => {
    const updated = [...polyAVertices, point];
    updateVerticesAndSync(updated);
  };

  const handleAddMidpoint = () => {
    if (polyAVertices.length < 2) return;
    const p1 = polyAVertices[polyAVertices.length - 1];
    const p2 = polyAVertices[0];
    const mid = interpolatePoint(p1, p2, 0.5);
    const updated = [...polyAVertices, mid];
    updateVerticesAndSync(updated);
  };

  const handleRemovePoint = () => {
    if (polyAVertices.length === 0) return;
    const updated = polyAVertices.slice(0, -1);
    updateVerticesAndSync(updated);
  };

  const handleResetDefault = () => {
    const def = getDefaultPolygonA();
    updateVerticesAndSync(def);
  };

  const handleApplyLShape = () => {
    const lShape = getLShapePolygon();
    updateVerticesAndSync(lShape);
  };

  const handleSplitHorizontal = (ratio: number = 0.6) => {
    const { polyA } = splitQuadHorizontal(realActiveCoords, ratio);
    updateVerticesAndSync(polyA);
  };

  const handleSplitVertical = (ratio: number = 0.5) => {
    const { polyA } = splitQuadVertical(realActiveCoords, ratio);
    updateVerticesAndSync(polyA);
  };

  const polyBVertices: [number, number][] = useMemo(() => {
    if (mutationData.splitCustomPointsB && mutationData.splitCustomPointsB.length >= 3) {
      return mutationData.splitCustomPointsB;
    }
    return computePolygonB(polyAVertices);
  }, [mutationData.splitCustomPointsB, computePolygonB, polyAVertices]);

  return {
    splitShapeOption,
    setSplitShapeOption,
    customResidualType,
    setCustomResidualType,
    customSplitReason,
    setCustomSplitReason,
    dynamicCodes,
    maxZoneInfo,
    polyAVertices,
    setPolyAVertices,
    polyBVertices,
    calculatedAreaA,
    calculatedAreaB,
    getDefaultPolygonA,
    getLShapePolygon,
    computePolygonB,
    handleVertexDrag,
    handleMapClickDraw,
    handleAddMidpoint,
    handleRemovePoint,
    handleResetDefault,
    handleApplyLShape,
    handleSplitHorizontal,
    handleSplitVertical,
  };
};
