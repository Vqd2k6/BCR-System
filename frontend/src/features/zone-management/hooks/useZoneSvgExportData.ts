import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/errorUtils';
import { api } from '../../../services/api';
import type { SvgParcelInput } from '../utils/zoneSvgTechnicalExporter';

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number';

/** Lấy vòng ngoài của GeoJSON Polygon, đảo [lng, lat] sang [lat, lng]; thiếu hình học trả mảng rỗng. */
const parseOuterRing = (geojson: unknown): [number, number][] => {
  if (typeof geojson !== 'object' || geojson === null) return [];
  const { type, coordinates } = geojson as { type?: unknown; coordinates?: unknown };
  if (type !== 'Polygon' || !Array.isArray(coordinates) || !Array.isArray(coordinates[0])) return [];
  return (coordinates[0] as unknown[]).filter(isPosition).map(([lng, lat]) => [lat, lng]);
};

const toSvgParcel = (raw: Record<string, unknown>): SvgParcelInput => ({
  code: String(raw.project_parcel_code ?? ''),
  isCondoMaster: raw.building_type === 'CONDOMINIUM',
  ring: parseOuterRing(raw.cadastral_geojson),
});

/** Nguồn dữ liệu chung cho cả 3 màn hình, độc lập với bộ lọc và phân trang của từng màn hình. */
export const useZoneSvgExportData = (zoneId: string) => {
  const [parcels, setParcels] = useState<SvgParcelInput[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isStale = false;
    setIsLoading(true);
    setError(null);

    const loadParcels = async () => {
      try {
        const res = await api.get('/parcels/zone-map', { params: { zoneId } });
        const rawList: unknown = res.data?.data;
        if (!Array.isArray(rawList)) {
          throw new Error('Máy chủ không trả về danh sách thửa đất hợp lệ');
        }
        if (!isStale) setParcels((rawList as Record<string, unknown>[]).map(toSvgParcel));
      } catch (err: unknown) {
        console.error('[ZoneSvgExport:LoadParcels] Failed to load parcels:', err);
        if (!isStale) {
          setParcels([]);
          setError(getErrorMessage(err, 'Không thể tải dữ liệu thửa đất của Zone.'));
        }
      } finally {
        if (!isStale) setIsLoading(false);
      }
    };

    loadParcels();
    return () => {
      isStale = true;
    };
  }, [zoneId]);

  return { parcels, isLoading, error };
};
