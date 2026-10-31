import { calculateDistancesFromPolygon } from '../utils/metro-spatial.utils';

type JsonRecord = Record<string, unknown>;

export function parseMeters(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).trim();
  if (!s || /không có ga/i.test(s)) return null;
  const match = s.replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function toPolygonCoords(val: unknown): [number, number][] | null {
  return Array.isArray(val) && val.length >= 3 ? (val as [number, number][]) : null;
}

function isRecord(val: unknown): val is JsonRecord {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export interface GeometryUpdateResult {
  didPolygonCoordsChange: boolean;
  recalculatedCenterlineM: number | null;
  recalculatedOuterM: number | null;
  newCadastralGeoJsonStr: string | null;
}

/**
 * Áp ranh thửa mới lên `mergedJson` và tính lại cự ly Metro. Dùng chung cho Nhà dân và Tòa nhà mẹ để hai luồng
 * luôn ra cùng một cự ly từ cùng một đa giác. Tọa độ đầu vào là `[lat, lng]`, GeoJSON đầu ra là `[lng, lat]`.
 */
export function resolvePolygonGeometryUpdate(
  updates: JsonRecord,
  existingJson: JsonRecord,
  mergedJson: JsonRecord
): GeometryUpdateResult {
  const candidateCoords = toPolygonCoords(updates.parcelCoordinates) ?? toPolygonCoords(updates.polygonCoords);
  const existingPolyCoords = toPolygonCoords(existingJson.parcelCoordinates) ?? toPolygonCoords(existingJson.polygonCoords);
  const didPolygonCoordsChange = Boolean(
    candidateCoords && (!existingPolyCoords || JSON.stringify(candidateCoords) !== JSON.stringify(existingPolyCoords))
  );

  let recalculatedCenterlineM: number | null = null;
  let recalculatedOuterM: number | null = null;
  let newCadastralGeoJsonStr: string | null = null;

  if (candidateCoords) {
    const metroRes = calculateDistancesFromPolygon(candidateCoords);
    const manualCenterlineM = parseMeters(updates.metroOffsetDistance ?? updates.manualMetroDistanceM ?? updates.distanceToMetroM);
    const manualOuterM = parseMeters(updates.clearanceOffsetDistance ?? updates.stationEdgeDistance);

    if (manualCenterlineM !== null && (!didPolygonCoordsChange || String(updates.metroOffsetDistance ?? '') !== String(existingJson.metroOffsetDistance ?? ''))) {
      recalculatedCenterlineM = manualCenterlineM;
      mergedJson.metroOffsetDistance = String(updates.metroOffsetDistance ?? `${manualCenterlineM.toFixed(1)}m`);
    } else {
      recalculatedCenterlineM = metroRes.centerlineDist;
      if (recalculatedCenterlineM !== null) {
        mergedJson.metroOffsetDistance = `${recalculatedCenterlineM.toFixed(1)}m`;
      }
    }

    if (manualOuterM !== null && (!didPolygonCoordsChange || String(updates.clearanceOffsetDistance ?? '') !== String(existingJson.clearanceOffsetDistance ?? ''))) {
      recalculatedOuterM = manualOuterM;
      mergedJson.clearanceOffsetDistance = String(updates.clearanceOffsetDistance ?? `${manualOuterM.toFixed(1)}m`);
      mergedJson.stationEdgeDistance = String(updates.stationEdgeDistance ?? mergedJson.clearanceOffsetDistance);
    } else {
      recalculatedOuterM = metroRes.outerBoundaryDist;
      if (recalculatedOuterM !== null) {
        mergedJson.clearanceOffsetDistance = `${recalculatedOuterM.toFixed(1)}m`;
        mergedJson.stationEdgeDistance = `${recalculatedOuterM.toFixed(1)}m`;
      } else {
        mergedJson.clearanceOffsetDistance = 'Không có ga trong khu vực';
      }
    }

    const nextGps = isRecord(updates.gpsCoords) ? updates.gpsCoords : null;
    const curGps = isRecord(existingJson.gpsCoords) ? existingJson.gpsCoords : null;
    const explicitGpsChanged = Boolean(
      nextGps &&
        (!curGps ||
          Number(nextGps.lat ?? nextGps.latitude) !== Number(curGps.lat ?? curGps.latitude) ||
          Number(nextGps.lng ?? nextGps.longitude) !== Number(curGps.lng ?? curGps.longitude))
    );
    if (!explicitGpsChanged || didPolygonCoordsChange) {
      const bestPt = candidateCoords[0];
      if (Array.isArray(bestPt) && bestPt.length >= 2) {
        mergedJson.gpsCoords = {
          lat: Number(Number(bestPt[0]).toFixed(6)),
          lng: Number(Number(bestPt[1]).toFixed(6)),
        };
      }
    }

    mergedJson.parcelCoordinates = candidateCoords;
    mergedJson.polygonCoords = candidateCoords;

    const ringCoords: [number, number][] = candidateCoords.map((pt) => [pt[1], pt[0]]);
    const firstPt = ringCoords[0];
    const lastPt = ringCoords[ringCoords.length - 1];
    if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
      ringCoords.push([firstPt[0], firstPt[1]]);
    }
    newCadastralGeoJsonStr = JSON.stringify({ type: 'Polygon', coordinates: [ringCoords] });
  } else if (
    updates.metroOffsetDistance !== undefined ||
    updates.clearanceOffsetDistance !== undefined ||
    updates.manualMetroDistanceM !== undefined ||
    updates.distanceToMetroM !== undefined
  ) {
    if (
      updates.metroOffsetDistance !== undefined ||
      updates.manualMetroDistanceM !== undefined ||
      updates.distanceToMetroM !== undefined
    ) {
      recalculatedCenterlineM = parseMeters(
        updates.metroOffsetDistance ?? updates.manualMetroDistanceM ?? updates.distanceToMetroM
      );
    }
    if (updates.clearanceOffsetDistance !== undefined) {
      recalculatedOuterM = parseMeters(updates.clearanceOffsetDistance);
      mergedJson.clearanceOffsetDistance = String(updates.clearanceOffsetDistance);
      mergedJson.stationEdgeDistance = String(updates.clearanceOffsetDistance);
    }
  }

  return { didPolygonCoordsChange, recalculatedCenterlineM, recalculatedOuterM, newCadastralGeoJsonStr };
}
