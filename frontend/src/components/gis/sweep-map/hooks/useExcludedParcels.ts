import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import type { GisParcel } from '../../shared/types';
import { fetchExcludedParcels } from '../../shared/parcelExclusion';

/** Thửa đã ẩn chỉ dành cho Admin: Surveyor và Guest không gọi API này. */
export const useExcludedParcels = (selectedZone: string) => {
  const { user } = useAuth();
  const canViewExcluded = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [excludedParcels, setExcludedParcels] = useState<GisParcel[]>([]);

  const reloadExcluded = useCallback(async () => {
    if (!canViewExcluded) return;
    try {
      setExcludedParcels(await fetchExcludedParcels(selectedZone));
    } catch (err: unknown) {
      console.error('[useExcludedParcels:load] Không tải được thửa đã ẩn:', err);
      setExcludedParcels([]);
    }
  }, [canViewExcluded, selectedZone]);

  useEffect(() => {
    reloadExcluded();
  }, [reloadExcluded]);

  return { excludedParcels, canViewExcluded, reloadExcluded };
};
