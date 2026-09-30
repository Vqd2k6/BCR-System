import { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { api } from '../../../../services/api';
import { GisParcel, MutationPayloadData, CadastralParcelData, SplitChildData } from '../../shared/types';
import { computePolygonAreaM2, interpolatePoint } from '../../shared/geoMath';

interface UseCadastralMutationProps {
  activeParcelId: string;
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

export const useCadastralMutation = ({
  activeParcelId,
  parcelData,
  parcel,
  boundaryStatus,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}: UseCadastralMutationProps) => {
  const frontage = parcelData.frontageWidth || 4.2;
  const depth = parcelData.lotDepth || 18.5;
  const totalLandArea =
    parcelData.constructionArea || parcelData.landArea || Math.round(frontage * depth * 10) / 10 || 68.5;

  const [tileMode, setTileMode] = useState<'osm' | 'satellite'>('osm');
  const [zoneParcels, setZoneParcels] = useState<GisParcel[]>([]);
  const [_isLoadingZoneParcels, setIsLoadingZoneParcels] = useState<boolean>(false);

  // Load real parcels from API
  useEffect(() => {
    let isMounted = true;
    const fetchZoneParcels = async () => {
      try {
        setIsLoadingZoneParcels(true);
        let zoneId = parcel?.zoneId || (parcel as any)?.zone_id || parcelData.zoneId;
        if (!zoneId && activeParcelId) {
          try {
            const pRes = await api.get(`/parcels/${activeParcelId}`);
            const pData = pRes.data?.data || pRes.data;
            if (pData?.zone_id || pData?.zoneId) {
              zoneId = pData.zone_id || pData.zoneId;
            }
          } catch (_) {
            // ignore
          }
        }
        if (!zoneId || zoneId === 'ALL') {
          zoneId = 'ZONE_01';
        }
        const res = await api.get('/parcels/zone-map', { params: { zoneId } });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const mapped: GisParcel[] = res.data.data
            .map((p: any) => {
              let coords: [number, number][] = [];
              if (p.cadastral_geojson?.coordinates?.[0]) {
                coords = (p.cadastral_geojson.coordinates[0] as [number, number][]).map(
                  ([lng, lat]) => [lat, lng] as [number, number]
                );
              } else if (p.coordinates && Array.isArray(p.coordinates)) {
                coords = p.coordinates;
              }
              return {
                id: p.id,
                projectParcelCode: p.project_parcel_code || p.projectParcelCode || 'B-XXXXX',
                officialCadastralCode: p.official_cadastral_code || p.officialCadastralCode || '',
                houseNumber: p.house_number || p.houseNumber || '',
                street: p.street || '',
                ownerName: p.owner_name || p.ownerName || 'Chưa cập nhật',
                surveyStatus: p.survey_status || p.surveyStatus || 'NOT_SURVEYED',
                absenceAttemptCount: p.absence_attempt_count ?? p.absenceAttemptCount ?? 0,
                coordinates: coords,
                land_area_m2: p.land_area_m2 || p.landAreaM2 || p.cadastral_geojson?.properties?.area_m2 || 75.0,
              };
            })
            .filter((p: GisParcel) => p.coordinates.length >= 3);

          setZoneParcels(mapped);
        }
      } catch (_err) {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoadingZoneParcels(false);
      }
    };

    fetchZoneParcels();
    return () => {
      isMounted = false;
    };
  }, [parcel, parcelData.zoneId, activeParcelId]);

  // REAL POSTGIS COORDINATES OF ACTIVE PARCEL
  const realActiveCoords: [number, number][] = useMemo(() => {
    if (parcel?.coordinates && Array.isArray(parcel.coordinates) && parcel.coordinates.length >= 3) {
      return parcel.coordinates;
    }
    if (parcelData.coordinates && Array.isArray(parcelData.coordinates) && parcelData.coordinates.length >= 3) {
      return parcelData.coordinates;
    }
    const matched = zoneParcels.find(
      (zp) => zp.id === activeParcelId || zp.projectParcelCode === parcelData.projectParcelCode
    );
    if (matched && matched.coordinates.length >= 3) {
      return matched.coordinates;
    }
    if (zoneParcels.length > 0 && zoneParcels[0].coordinates.length >= 3) {
      return zoneParcels[0].coordinates;
    }
    const baseLat = 10.798123;
    const baseLng = 106.645678;
    const dLat = 0.00028;
    const dLng = 0.00032;
    return [
      [baseLat, baseLng],
      [baseLat + dLat, baseLng],
      [baseLat + dLat, baseLng + dLng],
      [baseLat, baseLng + dLng],
    ];
  }, [parcel, parcelData.coordinates, activeParcelId, parcelData.projectParcelCode, zoneParcels]);

  // Centroid of active parcel
  const activeCentroid: [number, number] = useMemo(() => {
    if (realActiveCoords.length === 0) return [10.798123, 106.645678];
    const avgLat = realActiveCoords.reduce((s, c) => s + c[0], 0) / realActiveCoords.length;
    const avgLng = realActiveCoords.reduce((s, c) => s + c[1], 0) / realActiveCoords.length;
    return [avgLat, avgLng];
  }, [realActiveCoords]);

  const calcDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  // Nearby parcels
  const [nearby30mParcels, setNearby30mParcels] = useState<GisParcel[]>([]);
  const [_isLoadingNearby, setIsLoadingNearby] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchNearby = async () => {
      const [cLat, cLng] = activeCentroid;
      if (!cLat || !cLng) return;
      try {
        setIsLoadingNearby(true);
        const res = await api.get('/parcels/nearby', {
          params: { lat: cLat, lng: cLng, radius: 30 },
        });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const mapped: GisParcel[] = res.data.data
            .map((p: any) => {
              let coords: [number, number][] = [];
              if (p.cadastral_geojson?.coordinates?.[0]) {
                coords = (p.cadastral_geojson.coordinates[0] as [number, number][]).map(
                  ([lngVal, latVal]) => [latVal, lngVal] as [number, number]
                );
              } else if (p.coordinates && Array.isArray(p.coordinates)) {
                coords = p.coordinates;
              }
              const dist =
                typeof p.distance_meters === 'number'
                  ? Math.round(p.distance_meters)
                  : calcDistanceMeters(cLat, cLng, coords[0]?.[0] || cLat, coords[0]?.[1] || cLng);

              return {
                id: p.id,
                projectParcelCode: p.project_parcel_code || p.projectParcelCode || 'B-XXXXX',
                officialCadastralCode: p.official_cadastral_code || p.officialCadastralCode || '',
                houseNumber: p.house_number || p.houseNumber || '',
                street: p.street || '',
                ownerName: p.owner_name || p.ownerName || 'Chưa cập nhật',
                surveyStatus: p.survey_status || p.surveyStatus || 'NOT_SURVEYED',
                absenceAttemptCount: p.absence_attempt_count ?? p.absenceAttemptCount ?? 0,
                coordinates: coords,
                distanceMeters: dist,
              };
            })
            .filter((p: GisParcel) => p.coordinates.length >= 3 && p.projectParcelCode !== parcelData.projectParcelCode);

          setNearby30mParcels(mapped);
        }
      } catch (_err) {
        console.warn('Could not fetch /parcels/nearby');
      } finally {
        if (isMounted) setIsLoadingNearby(false);
      }
    };

    fetchNearby();
    return () => {
      isMounted = false;
    };
  }, [activeCentroid, parcelData.projectParcelCode]);

  const [mergeSearchTerm, setMergeSearchTerm] = useState('');

  const currentZoneMergeParcels: GisParcel[] = useMemo(() => {
    return zoneParcels
      .filter((zp) => zp.projectParcelCode !== parcelData.projectParcelCode)
      .map((zp) => {
        const pCenterLat = zp.coordinates.reduce((s, c) => s + c[0], 0) / (zp.coordinates.length || 1);
        const pCenterLng = zp.coordinates.reduce((s, c) => s + c[1], 0) / (zp.coordinates.length || 1);
        const dist = Math.round(calcDistanceMeters(activeCentroid[0], activeCentroid[1], pCenterLat, pCenterLng));
        return { ...zp, distanceMeters: dist };
      })
      .sort((a, b) => ((a as any).distanceMeters || 0) - ((b as any).distanceMeters || 0));
  }, [zoneParcels, activeCentroid, parcelData.projectParcelCode]);

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

  const [splitShapeOption, setSplitShapeOption] = useState<'DRAG_HANDLES' | 'CLICK_TO_DRAW'>(
    mutationData.splitShapeOption || 'CLICK_TO_DRAW'
  );

  const [customResidualType, setCustomResidualType] = useState<string>('');
  const [customSplitReason, setCustomSplitReason] = useState<string>('');
  const [customMergeReason, setCustomMergeReason] = useState<string>('');
  const [customMergeResidualType, setCustomMergeResidualType] = useState<string>(
    mutationData.customMergeResidualType || ''
  );
  const [mergeBuildingVertices, setMergeBuildingVertices] = useState<[number, number][]>(() => {
    return mutationData.mergeBuildingCustomPoints || [];
  });

  const [dynamicCodes, setDynamicCodes] = useState<string[]>([]);
  const [_isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);
  const [isSubmittingMutation, setIsSubmittingMutation] = useState<boolean>(false);

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
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length > 0) {
      return mutationData.splitCustomPointsA;
    }
    return [];
  });

  useEffect(() => {
    if (splitShapeOption === 'DRAG_HANDLES' && polyAVertices.length < 3) {
      const def = getDefaultPolygonA();
      setPolyAVertices(def);
      onMutationDataChange({
        ...mutationData,
        splitShapeOption: 'DRAG_HANDLES',
        splitCustomPointsA: def,
      });
    }
  }, [splitShapeOption, getDefaultPolygonA]);

  useEffect(() => {
    let isMounted = true;
    const fetchCodes = async () => {
      try {
        setIsLoadingCodes(true);
        const res = await api.get('/parcels/next-high-range-codes?count=4');
        if (isMounted && res.data?.success && res.data.data?.codes) {
          const codes = res.data.data.codes;
          setDynamicCodes(codes);

          if (!mutationData.isSubmitted) {
            const currentChildren = mutationData.splitChildren || [];
            const isNewB = mutationData.residualKind === 'NEW_BUILDING';
            if (currentChildren.length === 0) {
              const initChildren: SplitChildData[] = [
                {
                  label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
                  houseNumber: parcelData.houseNumber,
                  ownerName: parcelData.ownerName || '',
                  suggestedCode: parcelData.projectParcelCode,
                  areaM2: Math.round(totalLandArea * 0.6 * 10) / 10,
                  functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                  isResidualSurplus: false,
                },
                {
                  label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: isNewB ? 'Chủ hộ Căn B' : 'Chủ sở hữu phần đất dôi dư',
                  suggestedCode: isNewB ? (codes[0] || 'B-07001') : `${parcelData.projectParcelCode}-DU`,
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
                  suggestedCode: isNewB ? (codes[0] || c.suggestedCode || 'B-07001') : `${parcelData.projectParcelCode}-DU`,
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
        const fallbackCodes = ['B-07001', 'B-07002'];
        if (isMounted) setDynamicCodes(fallbackCodes);
      } finally {
        if (isMounted) setIsLoadingCodes(false);
      }
    };

    fetchCodes();
    return () => {
      isMounted = false;
    };
  }, [boundaryStatus, parcelData.projectParcelCode]);

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

  const handleVertexDrag = (index: number, newLatLng: L.LatLng) => {
    const updated = [...polyAVertices];
    updated[index] = [newLatLng.lat, newLatLng.lng];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  const handleMapClickDraw = (point: [number, number]) => {
    const updated = [...polyAVertices, point];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  const handleAddMidpoint = () => {
    if (polyAVertices.length < 2) return;
    const p1 = polyAVertices[polyAVertices.length - 1];
    const p2 = polyAVertices[0];
    const mid = interpolatePoint(p1, p2, 0.5);
    const updated = [...polyAVertices, mid];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  const handleRemovePoint = () => {
    if (polyAVertices.length === 0) return;
    const updated = polyAVertices.slice(0, -1);
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  const handleResetDefault = () => {
    const def = getDefaultPolygonA();
    setPolyAVertices(def);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: def,
      isSubmitted: false,
    });
  };

  const handleApplyLShape = () => {
    const lShape = getLShapePolygon();
    setPolyAVertices(lShape);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: lShape,
      isSubmitted: false,
    });
  };

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
    if (mergeBuildingVertices.length >= 3) {
      const raw = computePolygonAreaM2(mergeBuildingVertices);
      if (raw > 0) return raw;
    }
    return (
      mutationData.mergeBuildingAreaM2 ||
      Math.round((mergeSummary.totalMergedArea || totalLandArea) * 0.65 * 10) / 10
    );
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
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
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

  const getPolygonB = useCallback((): [number, number][] => {
    if (realActiveCoords.length < 3) return realActiveCoords;
    if (polyAVertices.length >= 4) {
      const p0 = realActiveCoords[0];
      const p1 = realActiveCoords[1];
      const p2 = realActiveCoords[2];
      const p3 = realActiveCoords[3] || realActiveCoords[2];
      const cutR = polyAVertices[2] || interpolatePoint(p1, p2, 0.6);
      const cutL = polyAVertices[3] || interpolatePoint(p0, p3, 0.6);
      return [cutL, cutR, p2, p3];
    }
    return realActiveCoords;
  }, [realActiveCoords, polyAVertices]);

  const handleSaveMutationProposal = () => {
    if (boundaryStatus === 'SPLIT' && !mutationData.splitReason?.trim()) {
      alert('Vui lòng chọn hoặc nhập Lý do chia tách thửa đất thực tế trước khi xác nhận đề xuất!');
      const el = document.getElementById('input-splitReason');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmittingMutation(true);
    const nowStr = new Date().toLocaleTimeString('vi-VN');
    const polyB = getPolygonB();

    const isNewB = mutationData.residualKind === 'NEW_BUILDING';
    const currentChildren: SplitChildData[] = mutationData.splitChildren && mutationData.splitChildren.length > 0
      ? mutationData.splitChildren
      : [
          {
            label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
            houseNumber: parcelData.houseNumber,
            ownerName: parcelData.ownerName || '',
            suggestedCode: parcelData.projectParcelCode,
            areaM2: calculatedAreaA,
            functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
            isResidualSurplus: false,
          },
          {
            label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
            houseNumber: `${parcelData.houseNumber}B`,
            ownerName: isNewB ? 'Chủ hộ Căn B' : 'Chủ sở hữu phần đất dôi dư',
            suggestedCode: isNewB ? (dynamicCodes[0] || 'B-07001') : `${parcelData.projectParcelCode}-DU`,
            areaM2: calculatedAreaB,
            functionalType: customResidualType || (isNewB ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS'),
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

    const updatedChildren: SplitChildData[] = currentChildren.map((c, idx) => {
      if (idx === 0) {
        return {
          ...c,
          suggestedCode: parcelData.projectParcelCode,
          areaM2: calculatedAreaA,
          coordinates: polyAVertices,
        };
      }
      if (idx === 1) {
        return {
          ...c,
          label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
          suggestedCode: isNewB
            ? (c.suggestedCode && c.suggestedCode !== `${parcelData.projectParcelCode}-DU` ? c.suggestedCode : (dynamicCodes[0] || 'B-07001'))
            : `${parcelData.projectParcelCode}-DU`,
          areaM2: calculatedAreaB,
          residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
          isResidualSurplus: !isNewB,
          coordinates: polyB,
          residualParentParcelCode: parcelData.projectParcelCode,
          residualParentCadastralCode: parcelData.officialCadastralCode,
          residualMetadataNote: isNewB
            ? `Nhà mới tách từ ${parcelData.projectParcelCode}`
            : `Đất thừa tách từ ${parcelData.projectParcelCode}`,
        };
      }
      return c;
    });

    const updatedMutation: MutationPayloadData = {
      ...mutationData,
      isSubmitted: true,
      activeProposalType: boundaryStatus,
      residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
      matchConfirmed: false,
      submittedAt: nowStr,
      splitShapeOption,
      splitCustomPointsA: polyAVertices,
      splitCustomPointsB: polyB,
      splitChildren: updatedChildren,
      mergeBuildingCustomPoints: mergeBuildingVertices,
      mergeResidualParcelCode: mutationData.mergeResidualParcelCode || `${mergeSummary.keptCode}-P2`,
      mergeBuildingAreaM2: calculatedMergeBArea,
      mergeResidualAreaM2: calculatedMergeRArea,
      mergeResidualCustomPoints: realActiveCoords,
    };

    onMutationDataChange(updatedMutation);

    if (onToastMessage) {
      onToastMessage(
        `✓ Đã ghi nhận đề xuất ${boundaryStatus === 'SPLIT' ? 'Tách thửa' : 'Gộp thửa'} kèm tọa độ polygon các lô vào hồ sơ thửa ${parcelData.projectParcelCode}!`
      );
    }

    setTimeout(() => {
      setIsSubmittingMutation(false);
    }, 200);
  };

  return {
    frontage,
    depth,
    totalLandArea,
    tileMode,
    setTileMode,
    zoneParcels,
    realActiveCoords,
    activeCentroid,
    nearby30mParcels,
    currentZoneMergeParcels,
    filteredMergeParcels,
    mergeSearchTerm,
    setMergeSearchTerm,
    splitShapeOption,
    setSplitShapeOption,
    customResidualType,
    setCustomResidualType,
    customSplitReason,
    setCustomSplitReason,
    customMergeReason,
    setCustomMergeReason,
    customMergeResidualType,
    setCustomMergeResidualType,
    dynamicCodes,
    isSubmittingMutation,
    polyAVertices,
    setPolyAVertices,
    calculatedAreaA,
    calculatedAreaB,
    handleVertexDrag,
    handleMapClickDraw,
    handleAddMidpoint,
    handleRemovePoint,
    handleResetDefault,
    handleApplyLShape,
    selectedMergeCodes,
    mergeSummary,
    handleToggleMergeParcel,
    mergeBuildingVertices,
    setMergeBuildingVertices,
    calculatedMergeBArea,
    calculatedMergeRArea,
    handleMergeMapClickDraw,
    handleMergeRemoveLastPoint,
    handleMergeClearDraw,
    handleSaveMutationProposal,
  };
};
