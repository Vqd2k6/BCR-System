import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../services/api';
import {
  METRO_22_ZONES,
  getZoneByCode,
  type MetroZoneConfig,
} from '../../../../survey-phase1/constants/metroGisConstants';
import type { ExportParcelItem, ActionFeedbackMessage } from '../types';

/** Số thửa mỗi trang ở màn Xuất (chốt 18/11/2026). */
export const PHASE1_EXPORT_PAGE_SIZE = 20;

export interface UsePhase1ExportDataProps {
  initialZoneId?: string;
  assignedZoneId?: string | null;
}

export const usePhase1ExportData = ({
  initialZoneId = 'ZONE_01',
  assignedZoneId,
}: UsePhase1ExportDataProps) => {
  const resolveInitialZone = useCallback((zoneId?: string | null): string => {
    if (!zoneId) return 'ZONE_01';
    const upper = zoneId.toUpperCase().trim();
    if (upper === 'ALL' || upper === 'ALL_ZONES') return 'ALL';
    const matched = getZoneByCode(upper);
    if (matched) {
      return matched.isDataReady ? matched.code : 'ZONE_01';
    }
    const direct = METRO_22_ZONES.find((z: MetroZoneConfig) => z.code === upper);
    if (direct) {
      return direct.isDataReady ? direct.code : 'ZONE_01';
    }
    return 'ZONE_01';
  }, []);

  const [selectedZone, setSelectedZone] = useState<string>(() => {
    return resolveInitialZone(initialZoneId || assignedZoneId);
  });

  useEffect(() => {
    if (initialZoneId) {
      setSelectedZone(resolveInitialZone(initialZoneId));
    } else if (assignedZoneId) {
      setSelectedZone(resolveInitialZone(assignedZoneId));
    }
  }, [initialZoneId, assignedZoneId, resolveInitialZone]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [parcels, setParcels] = useState<ExportParcelItem[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<ActionFeedbackMessage | null>(null);

  // Phân trang phía máy chủ (18/11/2026): mỗi lần chỉ tải 1 trang, lọc / tìm kiếm chạy trên máy chủ cho toàn Zone.
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [hiddenCondoCount, setHiddenCondoCount] = useState<number>(0);
  const [zoneTotal, setZoneTotal] = useState<number>(0);
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Đổi Zone / trạng thái / từ khoá ⇒ về trang 1 và bỏ chọn.
  useEffect(() => {
    setPage(1);
    setSelectedParcelIds([]);
  }, [selectedZone, statusFilter, debouncedSearch]);

  const requestSeqRef = useRef<number>(0);

  const fetchExportableParcels = useCallback(async () => {
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await api.get('/phase1-export/parcels', {
        params: { zoneId: selectedZone, status: statusFilter, q: debouncedSearch, page, pageSize: PHASE1_EXPORT_PAGE_SIZE },
      });

      const rawList: Record<string, unknown>[] = Array.isArray(res.data?.data) ? (res.data.data as Record<string, unknown>[]) : [];
      const pagination = (res.data?.pagination ?? {}) as { total?: unknown };
      const meta = (res.data?.meta ?? {}) as { hiddenCondoCount?: unknown; zoneTotal?: unknown };
      if (seq !== requestSeqRef.current) return; // đã có yêu cầu mới hơn
      const totalCount = typeof pagination.total === 'number' ? pagination.total : 0;
      setTotal(totalCount);
      setHiddenCondoCount(typeof meta.hiddenCondoCount === 'number' ? meta.hiddenCondoCount : 0);
      setZoneTotal(typeof meta.zoneTotal === 'number' ? meta.zoneTotal : 0);
      // Trang hiện tại vượt quá số trang (VD vừa có thửa đổi trạng thái) ⇒ lùi về trang cuối.
      const lastPage = Math.max(1, Math.ceil(totalCount / PHASE1_EXPORT_PAGE_SIZE));
      if (rawList.length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }

      const mapped: ExportParcelItem[] = rawList.map((item) => ({
        id: String(item.id || ''),
        projectParcelCode: String(item.project_parcel_code || item.projectParcelCode || 'CHƯA_CÓ_MÃ'),
        officialCadastralCode: String(item.official_cadastral_code || item.officialCadastralCode || ''),
        houseNumber: String(item.house_number || item.houseNumber || ''),
        street: String(item.street || ''),
        ownerName: String(item.owner_name || item.ownerName || 'Chưa cập nhật'),
        surveyStatus: (item.survey_status || item.surveyStatus || 'NOT_SURVEYED') as ExportParcelItem['surveyStatus'],
        buildingType: (item.building_type || item.buildingType || 'STANDALONE') as ExportParcelItem['buildingType'],
        floorCount: Number(item.floor_count ?? item.floorCount ?? 1),
        activePhase1ReportId: String(item.active_phase1_report_id || item.activePhase1ReportId || item.id || ''),
        ecsClass: String(item.ecs_class || 'GOOD'),
        viClass: String(item.vi_class || 'LOW'),
        braClass: String(item.bra_class || 'LOW'),
        updatedAt: item.updated_at ? String(item.updated_at) : (item.updatedAt ? String(item.updatedAt) : undefined),
        pendingCrops: typeof item.pending_crops === 'number' ? item.pending_crops : 0,
        resurveyPending: typeof item.resurvey_pending === 'number' ? item.resurvey_pending : 0,
      }));

      if (seq !== requestSeqRef.current) return; // đã có yêu cầu mới hơn (đổi trang / lọc nhanh)
      setParcels(mapped);
    } catch (err: unknown) {
      if (seq !== requestSeqRef.current) return;
      console.error('[Phase1ExportModule:list] Không tải được danh sách thửa:', getErrorMessage(err));
      setParcels([]);
      setActionMessage({
        type: 'error',
        text: getErrorMessage(err, 'Không thể tải danh sách thửa đất thực tế từ máy chủ CSDL.'),
      });
    } finally {
      if (seq === requestSeqRef.current) setIsLoading(false);
    }
  }, [selectedZone, statusFilter, debouncedSearch, page]);

  useEffect(() => {
    fetchExportableParcels();
  }, [fetchExportableParcels]);

  // Lọc / tìm kiếm đã chạy trên máy chủ: danh sách hiển thị chính là trang hiện tại.
  const filteredParcels = parcels;

  // Selection handlers (áp cho trang hiện tại)
  const toggleSelectAll = () => {
    if (selectedParcelIds.length === filteredParcels.length) {
      setSelectedParcelIds([]);
    } else {
      setSelectedParcelIds(filteredParcels.map((p) => p.id));
    }
  };

  const toggleSelectParcel = (id: string) => {
    setSelectedParcelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return {
    selectedZone,
    setSelectedZone,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    parcels,
    filteredParcels,
    selectedParcelIds,
    actionMessage,
    setActionMessage,
    fetchExportableParcels,
    toggleSelectAll,
    toggleSelectParcel,
    page,
    setPage,
    pageSize: PHASE1_EXPORT_PAGE_SIZE,
    total,
    hiddenCondoCount,
    zoneTotal,
  };
};
