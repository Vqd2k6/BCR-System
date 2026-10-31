import { useMemo, useState } from 'react';
import { calculateComprehensiveMetroSpatialMetrics } from '../../../../../survey-phase1/utils/metroSpatialCalculator';

type LatLng = [number, number];

export const formatDistanceDisplay = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '---';
  const str = String(val).trim();
  const num = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return '---';
  return `${num.toFixed(1)} m`;
};

export const normalizePolygonRing = (coords: LatLng[] | undefined): LatLng[] => {
  if (!Array.isArray(coords)) return [];
  const valid = coords.filter(
    (pt): pt is LatLng =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
  );
  if (valid.length > 3) {
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      return valid.slice(0, -1);
    }
  }
  return valid;
};

export const arePolygonsDifferent = (
  polyA: LatLng[] | undefined,
  polyB: LatLng[] | undefined,
  tolerance = 0.00001
): boolean => {
  const ringA = normalizePolygonRing(polyA);
  const ringB = normalizePolygonRing(polyB);
  if (ringA.length < 3 || ringB.length < 3) return false;
  if (ringA.length !== ringB.length) return true;
  for (let i = 0; i < ringA.length; i++) {
    if (
      Math.abs(ringA[i][0] - ringB[i][0]) > tolerance ||
      Math.abs(ringA[i][1] - ringB[i][1]) > tolerance
    ) {
      return true;
    }
  }
  return false;
};

interface BoundaryFormFields {
  parcelCoordinates?: LatLng[];
  metroOffsetDistance?: unknown;
  clearanceOffsetDistance?: unknown;
  keepKsvBoundaryConfirmed?: unknown;
}

interface BoundaryData {
  cadastralGeojson?: unknown;
  cadastral_geojson?: unknown;
  coordinates?: unknown;
  parcelCoordinates?: unknown;
}

interface Options {
  formState: BoundaryFormFields;
  surveyJson: Record<string, unknown>;
  data?: BoundaryData | null;
  gpsAccuracy?: number;
  handleFieldChange: (fieldKey: string, label: string, val: unknown) => void;
  handleApplySyncedGeometry?: (
    newCoords: LatLng[],
    newMetroDist: string,
    newClearanceDist: string,
    closestCenterVertex?: LatLng | null
  ) => void;
}

/** Phát hiện lệch ranh PostGIS / ranh hồ sơ và áp ranh đồng bộ; dùng chung cho Nhà dân và Tòa nhà mẹ. */
export function useParcelBoundarySync({
  formState,
  surveyJson,
  data,
  gpsAccuracy,
  handleFieldChange,
  handleApplySyncedGeometry,
}: Options) {
  // 1. Trích xuất đa giác ranh đất từ CSDL PostGIS (cadastralGeojson)
  const postgisPolygonCoords = useMemo<LatLng[]>(() => {
    const rawGeojson = data?.cadastralGeojson || data?.cadastral_geojson;
    if (rawGeojson) {
      try {
        const parsed =
          typeof rawGeojson === 'string'
            ? JSON.parse(rawGeojson)
            : (rawGeojson as { type?: string; coordinates?: LatLng[][] });
        if (parsed && parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          return normalizePolygonRing(parsed.coordinates[0].map(([lng, lat]: LatLng) => [lat, lng]));
        }
      } catch (e) {
        console.warn('[useParcelBoundarySync] Failed to parse cadastralGeojson:', e);
      }
    }
    return [];
  }, [data?.cadastralGeojson, data?.cadastral_geojson]);

  // 2. Trích xuất đa giác ranh đất đang lưu trong hồ sơ khảo sát (formState hoặc surveyJson)
  const surveyPolygonCoords = useMemo<LatLng[]>(() => {
    if (Array.isArray(formState.parcelCoordinates) && formState.parcelCoordinates.length >= 3) {
      return normalizePolygonRing(formState.parcelCoordinates);
    }
    const rawCoords = (surveyJson.parcelCoordinates || surveyJson.polygonCoords) as LatLng[] | undefined;
    if (Array.isArray(rawCoords) && rawCoords.length >= 3) {
      return normalizePolygonRing(rawCoords);
    }
    return [];
  }, [formState.parcelCoordinates, surveyJson.parcelCoordinates, surveyJson.polygonCoords]);

  // 3. Phát hiện xung đột ranh GPMB giữa PostGIS và Survey JSON (TC-SPA-01 & TC-SPA-02)
  const hasGpmbBoundaryConflict = useMemo<boolean>(() => {
    if (postgisPolygonCoords.length < 3 || surveyPolygonCoords.length < 3) return false;
    return arePolygonsDifferent(postgisPolygonCoords, surveyPolygonCoords);
  }, [postgisPolygonCoords, surveyPolygonCoords]);

  // 4. Trích xuất tọa độ Polygon hiển thị trên bản đồ
  const parcelCoords = useMemo<LatLng[]>(() => {
    if (surveyPolygonCoords.length >= 3) {
      return surveyPolygonCoords;
    }
    if (postgisPolygonCoords.length >= 3) {
      return postgisPolygonCoords;
    }
    const rawCoords = data?.coordinates as LatLng[] | undefined;
    if (Array.isArray(rawCoords) && rawCoords.length >= 3) {
      return rawCoords;
    }
    const rawParcelCoords = data?.parcelCoordinates as LatLng[] | undefined;
    if (Array.isArray(rawParcelCoords) && rawParcelCoords.length >= 3) {
      return rawParcelCoords;
    }
    return [];
  }, [surveyPolygonCoords, postgisPolygonCoords, data?.coordinates, data?.parcelCoordinates]);

  // 5. Tính toán chỉ số cự ly Trước/Sau cho Popover So Sánh (TC-SPA-03)
  const [showDistanceDiffPopover, setShowDistanceDiffPopover] = useState<boolean>(false);

  const distanceDiffPreview = useMemo(() => {
    const targetCoords = postgisPolygonCoords.length >= 3 ? postgisPolygonCoords : parcelCoords;
    const newMetrics = calculateComprehensiveMetroSpatialMetrics(targetCoords);
    const oldMetroStr = formatDistanceDisplay(formState.metroOffsetDistance ?? surveyJson.metroOffsetDistance);
    const oldClearanceStr = formatDistanceDisplay(formState.clearanceOffsetDistance ?? surveyJson.clearanceOffsetDistance);
    const newMetroVal = newMetrics.distanceToCenterlineMeters !== undefined ? newMetrics.distanceToCenterlineMeters.toFixed(1) : '0.0';
    const newClearanceVal =
      newMetrics.outerBoundaryType === 'STATION_OUTLINE' && newMetrics.distanceToOuterBoundaryMeters !== null
        ? newMetrics.distanceToOuterBoundaryMeters.toFixed(1)
        : 'Không có ga trong khu vực';

    return {
      targetCoords,
      closestCenterVertex: newMetrics.closestCenterVertex,
      oldVertexCount: surveyPolygonCoords.length || parcelCoords.length,
      newVertexCount: targetCoords.length,
      oldMetroDisplay: oldMetroStr,
      newMetroDisplay: `${newMetroVal} m`,
      newMetroValue: newMetroVal,
      oldClearanceDisplay: oldClearanceStr,
      newClearanceDisplay: newClearanceVal === 'Không có ga trong khu vực' ? newClearanceVal : `${newClearanceVal} m`,
      newClearanceValue: newClearanceVal,
    };
  }, [
    postgisPolygonCoords,
    parcelCoords,
    surveyPolygonCoords.length,
    formState.metroOffsetDistance,
    formState.clearanceOffsetDistance,
    surveyJson.metroOffsetDistance,
    surveyJson.clearanceOffsetDistance,
  ]);

  // Mở Popover So sánh cự ly Trước/Sau khi bấm nút Đồng bộ trắc địa PostGIS
  const handleSyncFromGis = () => {
    setShowDistanceDiffPopover(true);
  };

  // Xác nhận áp dụng Ranh đất PostGIS & Cự ly mới (Ràng buộc 02: cập nhật tọa độ ranh, cự ly & đỉnh gần Metro nhất, bảo toàn diện tích & mặt tiền)
  const handleConfirmApplySyncedGeometry = () => {
    const { targetCoords, closestCenterVertex, newMetroValue, newClearanceValue } = distanceDiffPreview;
    if (handleApplySyncedGeometry) {
      handleApplySyncedGeometry(targetCoords, newMetroValue, newClearanceValue, closestCenterVertex);
    } else {
      handleFieldChange('parcelCoordinates', 'Tọa độ đa giác ranh thửa (PostGIS GPMB)', targetCoords);
      handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro (m)', newMetroValue);
      handleFieldChange('clearanceOffsetDistance', 'Cự ly đường bao ngoài / mép ga (m)', newClearanceValue);
      if (closestCenterVertex && closestCenterVertex.length >= 2) {
        handleFieldChange('gpsCoords', 'Tọa độ đỉnh ranh gần Metro nhất (PostGIS)', {
          lat: Number(closestCenterVertex[0]),
          latitude: Number(closestCenterVertex[0]),
          lng: Number(closestCenterVertex[1]),
          longitude: Number(closestCenterVertex[1]),
          accuracy: gpsAccuracy || 1.5,
        });
      }
      if (formState.keepKsvBoundaryConfirmed) {
        handleFieldChange('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', false);
      }
    }
    setShowDistanceDiffPopover(false);
  };

  return {
    postgisPolygonCoords,
    surveyPolygonCoords,
    hasGpmbBoundaryConflict,
    parcelCoords,
    distanceDiffPreview,
    showDistanceDiffPopover,
    setShowDistanceDiffPopover,
    handleSyncFromGis,
    handleConfirmApplySyncedGeometry,
  };
}
