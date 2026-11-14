import { api } from '../../../services/api';
import type { ZoneThematicPayload } from '../types';

/** API client plugin GIS Visualization – mọi endpoint nằm dưới /gis-visualization. */
const BASE = '/gis-visualization';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function fetchZoneThematic(zoneId: string, signal?: AbortSignal): Promise<ZoneThematicPayload> {
  const res = await api.get<ApiEnvelope<ZoneThematicPayload>>(`${BASE}/thematic`, { params: { zoneId }, signal });
  return res.data.data;
}
