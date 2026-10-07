import { useState, useMemo, useEffect } from 'react';
import { api } from '../../../../services/api';
import { GisParcel, MutationPayloadData, CadastralParcelData, MaxZoneCodeInfo } from '../../shared/types';
import { computePolygonAreaM2 } from '../../shared/geoMath';

interface UseCadastralMergeProps {
  zoneParcels: GisParcel[];
  nearby30mParcels: GisParcel[];
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  activeParcelId?: string;
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
  parcel,
  activeParcelId,
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
  const [dynamicCodes, setDynamicCodes] = useState<string[]>([]);
  const [maxZoneInfo, setMaxZoneInfo] = useState<MaxZoneCodeInfo | null>(null);
  const [_isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);

  // Fetch dynamic codes for NEW_BUILDING branch (Max Zone + 1)
  useEffect(() => {
    let isMounted = true;
    const fetchCodes = async () => {
      try {
        setIsLoadingCodes(true);
        const resolvedZone = parcel?.zoneId || (parcel as any)?.zone_id || parcelData.zoneId || 'ZONE_01';
        const pId = parcelData.id || activeParcelId;
        const qParcel = pId ? `&parcelId=${encodeURIComponent(pId)}` : '';
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
        }
      } catch (err) {
        console.warn('[useCadastralMerge] Could not fetch next high range codes:', err);
      } finally {
        if (isMounted) setIsLoadingCodes(false);
      }
    };
    fetchCodes();
    return () => {
      isMounted = false;
    };
  }, [parcel?.zoneId, parcelData.zoneId, parcelData.id, activeParcelId]);

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

  const isSurveyedParcel = (code: string): boolean => {
    if (code === parcelData.projectParcelCode) {
      const st = parcelData.surveyStatus;
      return st === 'APPROVED' || st === 'SUBMITTED' || st === 'IN_PROGRESS' || st === 'PHASE2_COMPLETED' || st === 'APPROVED_PHASE2';
    }
    const p = currentZoneMergeParcels.find((zp) => zp.projectParcelCode === code);
    if (!p) return false;
    const st = (p.surveyStatus || (p as any)?.survey_status) as string;
    return st === 'APPROVED' || st === 'SUBMITTED' || st === 'IN_PROGRESS' || st === 'PHASE2_COMPLETED' || st === 'APPROVED_PHASE2';
  };

  const getSurveyBadgeInfo = (code: string): { label: string; bg: string; color: string; border: string } => {
    let st: string | undefined;
    if (code === parcelData.projectParcelCode) {
      st = parcelData.surveyStatus;
    } else {
      const p = currentZoneMergeParcels.find((zp) => zp.projectParcelCode === code);
      st = (p?.surveyStatus || (p as any)?.survey_status) as string;
    }

    switch (st) {
      case 'IN_PROGRESS':
        return { label: 'Đang KS', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'SUBMITTED':
        return { label: 'Đã nộp (Chờ duyệt)', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
      case 'APPROVED':
        return { label: 'Đã duyệt', bg: '#dcfce7', color: '#15803d', border: '#86efac' };
      case 'PHASE2_COMPLETED':
      case 'APPROVED_PHASE2':
        return { label: 'Phase 2', bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' };
      case 'REJECTED':
        return { label: 'Bị từ chối', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
      case 'POSTPONED_ABSENT':
        return { label: 'Vắng chủ', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
      default:
        return { label: 'Chưa KS', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
    }
  };

  const mergeSummary = useMemo(() => {
    const allMergeCodes = Array.from(new Set([parcelData.projectParcelCode, ...selectedMergeCodes]));

    // XÁC ĐỊNH THỬA ĐẠI DIỆN CHÍNH THỨC (KEPT CODE)
    let keptCode = parcelData.projectParcelCode;
    if (mutationData.primaryMergeCode && allMergeCodes.includes(mutationData.primaryMergeCode)) {
      // 1. Người dùng / Admin đã chủ động click chọn
      keptCode = mutationData.primaryMergeCode;
    } else {
      // 2. Logic nghiệp vụ tự động:
      // - Nếu thửa đang mở thao tác là thửa đang KS hoặc đã KS -> giữ lại làm gốc
      // - Nếu không, ưu tiên thửa nào trong nhóm đã được khảo sát
      const surveyedCodes = allMergeCodes.filter(isSurveyedParcel);
      if (surveyedCodes.includes(parcelData.projectParcelCode)) {
        keptCode = parcelData.projectParcelCode;
      } else if (surveyedCodes.length > 0) {
        keptCode = surveyedCodes[0];
      } else {
        // Cả 2 đều chưa khảo sát: Giữ nguyên thửa gốc ban đầu mở editor
        keptCode = parcelData.projectParcelCode;
      }
    }

    const deprecatedCodes = allMergeCodes.filter((c) => c !== keptCode);

    // Ép kiểu số học Number() triệt để tránh lỗi chuỗi: "58" + "35.00" = "5835 m²"
    let totalMergedArea = Number(totalLandArea) || 0;
    selectedMergeCodes.forEach((code) => {
      const p = currentZoneMergeParcels.find((zp) => zp.projectParcelCode === code);
      const approxArea = Number(p?.landArea || (p as any)?.land_area_m2) || 75.0;
      totalMergedArea += approxArea;
    });

    const surveyedCount = allMergeCodes.filter(isSurveyedParcel).length;
    const hasSurveyConflict = surveyedCount >= 2;

    return {
      allMergeCodes,
      keptCode,
      deprecatedCodes,
      totalMergedArea: Math.round(totalMergedArea * 10) / 10,
      hasSurveyConflict,
    };
  }, [
    selectedMergeCodes,
    parcelData.projectParcelCode,
    parcelData.surveyStatus,
    totalLandArea,
    currentZoneMergeParcels,
    mutationData.primaryMergeCode,
  ]);

  const handleToggleMergeParcel = (code: string) => {
    if (code === parcelData.projectParcelCode) return;
    const current = selectedMergeCodes;
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    const nextPrimary = mutationData.primaryMergeCode === code ? parcelData.projectParcelCode : mutationData.primaryMergeCode;

    onMutationDataChange({
      ...mutationData,
      selectedMergeCodes: next,
      mergeTargetCode: next[0] || '',
      primaryMergeCode: nextPrimary,
      isSubmitted: false,
    });
  };

  const mergePartitionKind: 'NON_BUILDING' | 'NEW_BUILDING' = mutationData.mergePartitionKind || 'NON_BUILDING';

  const mergeSecondaryOfficialCode = useMemo(() => {
    if (mergePartitionKind === 'NEW_BUILDING') {
      return mutationData.mergeSecondaryParcelCode || dynamicCodes[0] || (maxZoneInfo?.nextCode) || `${mergeSummary.keptCode}-B`;
    }
    return `${mergeSummary.keptCode}-DU`;
  }, [mergePartitionKind, mutationData.mergeSecondaryParcelCode, dynamicCodes, maxZoneInfo, mergeSummary.keptCode]);

  const handleSetMergePartitionKind = (kind: 'NON_BUILDING' | 'NEW_BUILDING') => {
    const nextCode = kind === 'NEW_BUILDING'
      ? (dynamicCodes[0] || maxZoneInfo?.nextCode || `${mergeSummary.keptCode}-B`)
      : `${mergeSummary.keptCode}-DU`;

    onMutationDataChange({
      ...mutationData,
      mergePartitionKind: kind,
      mergeResidualParcelCode: nextCode,
      mergeSecondaryParcelCode: nextCode,
      mergeSecondaryHouseNumber: mutationData.mergeSecondaryHouseNumber || `${parcelData.houseNumber}B`,
      mergeSecondaryOwnerName: mutationData.mergeSecondaryOwnerName || (kind === 'NEW_BUILDING' ? 'Chủ hộ mới' : 'Chủ sở hữu đất dôi dư'),
      mergeSecondaryFunctionalType: mutationData.mergeSecondaryFunctionalType || (kind === 'NEW_BUILDING' ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS'),
      isSubmitted: false,
    });
  };

  const handleUpdateMergeSecondaryField = (field: string, value: any) => {
    onMutationDataChange({
      ...mutationData,
      [field]: value,
      isSubmitted: false,
    });
  };

  const handleSetPrimaryMergeCode = (code: string) => {
    const allMergeCodes = Array.from(new Set([parcelData.projectParcelCode, ...selectedMergeCodes]));
    if (!allMergeCodes.includes(code)) return;
    const isNew = mutationData.mergePartitionKind === 'NEW_BUILDING';
    const secondaryCode = isNew ? (dynamicCodes[0] || `${code}-B`) : `${code}-DU`;
    onMutationDataChange({
      ...mutationData,
      primaryMergeCode: code,
      mergeResidualParcelCode: secondaryCode,
      mergeSecondaryParcelCode: secondaryCode,
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
      mergeResidualParcelCode: mergeSecondaryOfficialCode,
      mergeSecondaryParcelCode: mergeSecondaryOfficialCode,
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
      mergeResidualParcelCode: mergeSecondaryOfficialCode,
      mergeSecondaryParcelCode: mergeSecondaryOfficialCode,
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
      mergeResidualParcelCode: mergeSecondaryOfficialCode,
      mergeSecondaryParcelCode: mergeSecondaryOfficialCode,
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
    handleSetPrimaryMergeCode,
    isSurveyedParcel,
    getSurveyBadgeInfo,
    calculatedMergeBArea,
    calculatedMergeRArea,
    handleMergeMapClickDraw,
    handleMergeRemoveLastPoint,
    handleMergeClearDraw,
    dynamicCodes,
    maxZoneInfo,
    mergePartitionKind,
    mergeSecondaryOfficialCode,
    handleSetMergePartitionKind,
    handleUpdateMergeSecondaryField,
  };
};
