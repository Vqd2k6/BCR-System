import { useState, useMemo, useEffect } from 'react';
import { GisParcel, MutationPayloadData, CadastralParcelData } from '../../shared/types';
import { computePolygonAreaM2 } from '../../shared/geoMath';

interface UseCadastralMergeProps {
  zoneParcels: GisParcel[];
  nearby30mParcels: GisParcel[];
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  parcelData: CadastralParcelData;
  totalLandArea: number;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  calcDistanceMeters: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
  generateFallbackNeighbors: (
    activeCoords: [number, number][],
    activeCode: string,
    streetName?: string
  ) => GisParcel[];
}

export const useCadastralMerge = ({
  zoneParcels,
  nearby30mParcels,
  realActiveCoords,
  activeCentroid,
  parcelData,
  totalLandArea,
  mutationData,
  onMutationDataChange,
  calcDistanceMeters,
  generateFallbackNeighbors,
}: UseCadastralMergeProps) => {
  const [mergeSearchTerm, setMergeSearchTerm] = useState('');
  const [customMergeReason, setCustomMergeReason] = useState<string>('');
  const [customMergeResidualType, setCustomMergeResidualType] = useState<string>(
    mutationData.customMergeResidualType || ''
  );
  const [mergeBuildingVertices, setMergeBuildingVertices] = useState<[number, number][]>(() => {
    return mutationData.mergeBuildingCustomPoints || [];
  });

  useEffect(() => {
    const pts = mutationData.mergeBuildingCustomPoints || mutationData.mergeBuildingPolygon;
    if (pts && pts.length >= 3) {
      setMergeBuildingVertices(pts);
    }
  }, [mutationData.mergeBuildingCustomPoints, mutationData.mergeBuildingPolygon]);

  const currentZoneMergeParcels: GisParcel[] = useMemo(() => {
    const parcelMap = new Map<string, GisParcel>();

    // 1. Nạp thửa từ API toàn zone
    zoneParcels.forEach((zp) => {
      if (zp.projectParcelCode && zp.coordinates?.length >= 3) {
        parcelMap.set(zp.projectParcelCode, zp);
      }
    });

    // 2. Bổ sung từ API nearby nếu chưa có
    nearby30mParcels.forEach((np) => {
      if (np.projectParcelCode && np.coordinates?.length >= 3 && !parcelMap.has(np.projectParcelCode)) {
        parcelMap.set(np.projectParcelCode, np);
      }
    });

    // 3. Fallback: Nếu mạng chậm hoặc offline chưa tải kịp dữ liệu zone, tạo cụm thửa đất tiếp giáp bao quanh
    if (parcelMap.size === 0 && realActiveCoords.length >= 3) {
      const fallbackList = generateFallbackNeighbors(
        realActiveCoords,
        parcelData.projectParcelCode,
        parcelData.street
      );
      fallbackList.forEach((fp) => {
        parcelMap.set(fp.projectParcelCode, fp);
      });
    }

    return Array.from(parcelMap.values())
      .filter((zp) => zp.projectParcelCode !== parcelData.projectParcelCode)
      .map((zp) => {
        const pCenterLat = zp.coordinates.reduce((s, c) => s + c[0], 0) / (zp.coordinates.length || 1);
        const pCenterLng = zp.coordinates.reduce((s, c) => s + c[1], 0) / (zp.coordinates.length || 1);
        const dist = Math.round(calcDistanceMeters(activeCentroid[0], activeCentroid[1], pCenterLat, pCenterLng));
        return { ...zp, distanceMeters: dist };
      })
      .sort((a, b) => ((a as any).distanceMeters || 0) - ((b as any).distanceMeters || 0));
  }, [zoneParcels, nearby30mParcels, realActiveCoords, activeCentroid, parcelData.projectParcelCode, parcelData.street, calcDistanceMeters, generateFallbackNeighbors]);

  const filteredMergeParcels: GisParcel[] = useMemo(() => {
    if (!mergeSearchTerm.trim()) return currentZoneMergeParcels;
    const q = mergeSearchTerm.trim().toLowerCase();
    return currentZoneMergeParcels.filter(
      (p) =>
        p.projectParcelCode.toLowerCase().includes(q) ||
        (p.houseNumber && p.houseNumber.toLowerCase().includes(q)) ||
        (p.street && p.street.toLowerCase().includes(q)) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q))
    );
  }, [currentZoneMergeParcels, mergeSearchTerm]);

  const selectedMergeCodes: string[] = useMemo(() => {
    if (mutationData.selectedMergeCodes && Array.isArray(mutationData.selectedMergeCodes)) {
      return mutationData.selectedMergeCodes;
    }
    if (mutationData.mergeTargetCode) {
      return [mutationData.mergeTargetCode];
    }
    return [];
  }, [mutationData.selectedMergeCodes, mutationData.mergeTargetCode]);

  const mergeSummary = useMemo(() => {
    const allMergeCodes = Array.from(new Set([parcelData.projectParcelCode, ...selectedMergeCodes]));
    allMergeCodes.sort();
    const keptCode = allMergeCodes[0] || parcelData.projectParcelCode;
    const deprecatedCodes = allMergeCodes.filter((c) => c !== keptCode);

    let totalMergedArea = totalLandArea;
    selectedMergeCodes.forEach((code) => {
      const p = currentZoneMergeParcels.find((zp) => zp.projectParcelCode === code);
      const approxArea = (p as any)?.land_area_m2 || 75.0;
      totalMergedArea += approxArea;
    });

    return {
      keptCode,
      deprecatedCodes,
      totalMergedArea: Math.round(totalMergedArea * 10) / 10,
    };
  }, [selectedMergeCodes, parcelData.projectParcelCode, totalLandArea, currentZoneMergeParcels]);

  const handleToggleMergeParcel = (code: string) => {
    if (code === parcelData.projectParcelCode) return;
    const current = selectedMergeCodes;
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];

    onMutationDataChange({
      ...mutationData,
      selectedMergeCodes: next,
      mergeTargetCode: next[0] || '',
      isSubmitted: false,
    });
  };

  const calculatedMergeBArea = useMemo(() => {
    if (typeof mutationData.mergeBuildingAreaM2 === 'number' && mutationData.mergeBuildingAreaM2 > 0) {
      return mutationData.mergeBuildingAreaM2;
    }
    if (mergeBuildingVertices.length >= 3) {
      const raw = computePolygonAreaM2(mergeBuildingVertices);
      if (raw > 0) return raw;
    }
    return Math.round((mergeSummary.totalMergedArea || totalLandArea) * 0.65 * 10) / 10;
  }, [
    mergeBuildingVertices,
    mutationData.mergeBuildingAreaM2,
    mergeSummary.totalMergedArea,
    totalLandArea,
  ]);

  const calculatedMergeRArea = useMemo(() => {
    const total = mergeSummary.totalMergedArea || totalLandArea;
    return Math.max(0.1, Math.round((total - calculatedMergeBArea) * 10) / 10);
  }, [mergeSummary.totalMergedArea, totalLandArea, calculatedMergeBArea]);

  const handleMergeMapClickDraw = (point: [number, number]) => {
    const updated = [...mergeBuildingVertices, point];
    setMergeBuildingVertices(updated);
    const bArea = updated.length >= 3 ? computePolygonAreaM2(updated) : 0;
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const validBArea = bArea > 0 ? bArea : Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.max(0.1, Math.round((total - validBArea) * 10) / 10);

    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: updated,
      mergeBuildingAreaM2: validBArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-DU`,
      isSubmitted: false,
    });
  };

  const handleMergeRemoveLastPoint = () => {
    if (mergeBuildingVertices.length === 0) return;
    const updated = mergeBuildingVertices.slice(0, -1);
    setMergeBuildingVertices(updated);
    const bArea = updated.length >= 3 ? computePolygonAreaM2(updated) : 0;
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const validBArea = bArea > 0 ? bArea : Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.max(0.1, Math.round((total - validBArea) * 10) / 10);
    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: updated,
      mergeBuildingAreaM2: validBArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
      isSubmitted: false,
    });
  };

  const handleMergeClearDraw = () => {
    setMergeBuildingVertices([]);
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const bArea = Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.round((total - bArea) * 10) / 10;
    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: [],
      mergeBuildingAreaM2: bArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
      isSubmitted: false,
    });
  };

  return {
    mergeSearchTerm,
    setMergeSearchTerm,
    customMergeReason,
    setCustomMergeReason,
    customMergeResidualType,
    setCustomMergeResidualType,
    mergeBuildingVertices,
    setMergeBuildingVertices,
    currentZoneMergeParcels,
    filteredMergeParcels,
    selectedMergeCodes,
    mergeSummary,
    handleToggleMergeParcel,
    calculatedMergeBArea,
    calculatedMergeRArea,
    handleMergeMapClickDraw,
    handleMergeRemoveLastPoint,
    handleMergeClearDraw,
  };
};
