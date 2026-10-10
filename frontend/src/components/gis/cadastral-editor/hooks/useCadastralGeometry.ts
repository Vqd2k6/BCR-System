import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../services/api';
import type { GisParcel, CadastralParcelData } from '../../shared/types';
import { computeCentroid, parseCoordinatesFromGeoJson } from '../../shared/geoMath';

interface UseCadastralGeometryProps {
  activeParcelId: string;
  parcelData: CadastralParcelData;
  parcel?: GisParcel | null;
}

export const useCadastralGeometry = ({
  activeParcelId,
  parcelData,
  parcel,
}: UseCadastralGeometryProps) => {
  const [tileMode, setTileMode] = useState<'osm' | 'satellite'>('osm');
  const [zoneParcels, setZoneParcels] = useState<GisParcel[]>([]);
  const [isLoadingZoneParcels, setIsLoadingZoneParcels] = useState<boolean>(false);
  const [nearby30mParcels, setNearby30mParcels] = useState<GisParcel[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState<boolean>(false);

  // Helper suy luận Zone ID từ Project Code nếu props thiếu
  const resolveZoneId = (pZone?: string, pdZone?: string, code?: string): string => {
    if (pZone && pZone !== 'ALL') return pZone;
    if (pdZone && pdZone !== 'ALL') return pdZone;
    if (code) {
      const c = code.toUpperCase();
      if (c.startsWith('C&C-01')) return 'ZONE_01';
      if (c.startsWith('POR-01')) return 'ZONE_02';
      if (c.startsWith('C&C-02')) return 'ZONE_03';
      if (c.startsWith('POR-02')) return 'ZONE_04';
      if (c.startsWith('POR-04')) return 'ZONE_08';
      if (c.startsWith('C&C-05')) return 'ZONE_09';
    }
    return 'ZONE_01';
  };

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

  // Helper tạo danh sách thửa đất tiếp giáp bao quanh thửa gốc khi offline hoặc mạng chậm
  const generateFallbackNeighbors = (
    activeCoords: [number, number][],
    activeCode: string,
    streetName?: string
  ): GisParcel[] => {
    if (activeCoords.length < 3) return [];

    const lats = activeCoords.map((c) => c[0]);
    const lngs = activeCoords.map((c) => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const dLat = (maxLat - minLat) || 0.00008;
    const dLng = (maxLng - minLng) || 0.00003;

    const match = activeCode.match(/^(.*?)(\d+)$/);
    const prefix = match ? match[1] : `${activeCode}-`;
    const baseNum = match ? parseInt(match[2], 10) : 1;
    const padLen = match ? match[2].length : 4;

    const offsets: { dX: number; dY: number; numOffset: number }[] = [
      { dX: -1.08, dY: 0, numOffset: -1 },
      { dX: 1.08, dY: 0, numOffset: 1 },
      { dX: -2.16, dY: 0, numOffset: -2 },
      { dX: 2.16, dY: 0, numOffset: 2 },
      { dX: 0, dY: 1.12, numOffset: 3 },
      { dX: 0, dY: -1.12, numOffset: -3 },
      { dX: 1.08, dY: 1.12, numOffset: 4 },
      { dX: -1.08, dY: 1.12, numOffset: 5 },
    ];

    return offsets.map(({ dX, dY, numOffset }) => {
      let targetNum = baseNum + numOffset;
      if (targetNum <= 0) targetNum = baseNum + Math.abs(numOffset) + 10;
      const pCode = `${prefix}${String(targetNum).padStart(padLen, '0')}`;
      const shiftedCoords: [number, number][] = activeCoords.map(([lat, lng]) => [
        Number((lat + dY * dLat).toFixed(9)),
        Number((lng + dX * dLng).toFixed(9)),
      ]);

      return {
        id: `synthetic-${pCode}`,
        projectParcelCode: pCode,
        officialCadastralCode: `${pCode}-CAD`,
        houseNumber: `${targetNum}`,
        street: streetName || 'Đường nội khu',
        ownerName: `Chủ hộ ${pCode}`,
        surveyStatus: 'NOT_SURVEYED',
        absenceAttemptCount: 0,
        coordinates: shiftedCoords,
        landArea: Math.round(Number(parcelData.landArea || 75) * 10) / 10 || 75,
      };
    });
  };

  const resolvedZoneId = resolveZoneId(
    parcel?.zoneId || parcel?.zone_id,
    parcelData.zoneId,
    parcelData.projectParcelCode || parcel?.projectParcelCode
  );

  // Load real parcels from API
  useEffect(() => {
    let isMounted = true;
    const fetchZoneParcels = async () => {
      try {
        setIsLoadingZoneParcels(true);
        let zoneId = resolvedZoneId;
        if (!zoneId && activeParcelId) {
          try {
            const pRes = await api.get(`/parcels/${activeParcelId}`);
            const pData = pRes.data?.data || pRes.data;
            if (pData?.zone_id || pData?.zoneId) {
              zoneId = pData.zone_id || pData.zoneId;
            }
          } catch (_) {}
        }
        if (!zoneId || zoneId === 'ALL') {
          zoneId = 'ZONE_01';
        }
        const res = await api.get('/parcels/zone-map', { params: { zoneId } });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const mapped: GisParcel[] = (res.data.data as GisParcel[])
            .map((p: GisParcel) => {
              const coords = parseCoordinatesFromGeoJson(p);
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
                land_area_m2: p.land_area_m2 || p.landAreaM2 || 75.0,
                landArea: p.land_area_m2 || p.landAreaM2 || 75.0,
              };
            })
            .filter((p: GisParcel) => p.coordinates.length >= 3);

          setZoneParcels(mapped);
        }
      } catch (_err) {
        console.warn('[useCadastralGeometry] Could not fetch zone-map:', _err);
      } finally {
        if (isMounted) setIsLoadingZoneParcels(false);
      }
    };

    fetchZoneParcels();
    return () => {
      isMounted = false;
    };
  }, [resolvedZoneId, activeParcelId, parcelData.projectParcelCode]);

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
    return computeCentroid(realActiveCoords);
  }, [realActiveCoords]);

  // Nearby parcels
  useEffect(() => {
    let isMounted = true;
    const fetchNearby = async () => {
      const [cLat, cLng] = activeCentroid;
      if (!cLat || !cLng) return;
      try {
        setIsLoadingNearby(true);
        const res = await api.get('/parcels/nearby', {
          params: { lat: cLat, lng: cLng, radius: 120 },
        });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const mapped: GisParcel[] = (res.data.data as GisParcel[])
            .map((p: GisParcel) => {
              const coords = parseCoordinatesFromGeoJson(p);
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
                land_area_m2: p.land_area_m2 || p.landAreaM2 || 75.0,
                landArea: p.land_area_m2 || p.landAreaM2 || 75.0,
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
  }, [activeCentroid[0], activeCentroid[1], parcelData.projectParcelCode]);

  return {
    tileMode,
    setTileMode,
    zoneParcels,
    isLoadingZoneParcels,
    nearby30mParcels,
    isLoadingNearby,
    realActiveCoords,
    activeCentroid,
    calcDistanceMeters,
    generateFallbackNeighbors,
  };
};
