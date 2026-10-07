import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../../../../services/api';
import { METRO_22_ZONES, getZoneByCode, MetroZoneConfig } from '../../../../survey-phase1/constants/metroGisConstants';
import { ExportParcelItem, BatchResultData, ActionFeedbackMessage } from '../types';

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

  // Batch Export Execution State
  const [isBatchExporting, setIsBatchExporting] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<BatchResultData | null>(null);

  // Load real list of parcels & report statuses from backend API
  const fetchExportableParcels = useCallback(async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await api.get('/parcels/zone-map', {
        params: { zoneId: selectedZone },
      });

      let rawList: any[] = [];
      if (res.data?.success && Array.isArray(res.data.data)) {
        rawList = res.data.data;
      } else if (Array.isArray(res.data)) {
        rawList = res.data;
      } else if (res.data?.data?.items && Array.isArray(res.data.data.items)) {
        rawList = res.data.data.items;
      }

      const mapped: ExportParcelItem[] = rawList.map((item: any) => ({
        id: item.id,
        projectParcelCode: item.project_parcel_code || item.projectParcelCode || 'CHƯA_CÓ_MÃ',
        officialCadastralCode: item.official_cadastral_code || item.officialCadastralCode || '',
        houseNumber: item.house_number || item.houseNumber || '',
        street: item.street || '',
        ownerName: item.owner_name || item.ownerName || 'Chưa cập nhật',
        surveyStatus: item.survey_status || item.surveyStatus || 'NOT_SURVEYED',
        buildingType: item.building_type || item.buildingType || 'STANDALONE',
        floorCount: Number(item.floor_count ?? item.floorCount ?? 1),
        activePhase1ReportId: item.active_phase1_report_id || item.activePhase1ReportId || item.id,
        ecsClass: item.ecs_class || 'GOOD',
        viClass: item.vi_class || 'LOW',
        braClass: item.bra_class || 'LOW',
        updatedAt: item.updated_at || item.updatedAt,
      }));

      setParcels(mapped);
    } catch (err: any) {
      console.error('[Phase1ExportModule] API call failed:', err?.message);
      setParcels([]);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể tải danh sách thửa đất thực tế từ máy chủ CSDL.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone]);

  useEffect(() => {
    fetchExportableParcels();
  }, [fetchExportableParcels]);

  // Filtering
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      const matchStatus = statusFilter === 'ALL' || p.surveyStatus === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.projectParcelCode.toLowerCase().includes(q) ||
        (p.officialCadastralCode && p.officialCadastralCode.toLowerCase().includes(q)) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.houseNumber.toLowerCase().includes(q) ||
        p.street.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  }, [parcels, statusFilter, searchQuery]);

  // Selection handlers
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

  const handleCreateBatchExport = async () => {
    setIsBatchExporting(true);
    setActionMessage({ type: 'info', text: 'Đang gửi lệnh đóng gói hồ sơ Phase 1 lên máy chủ...' });

    try {
      const payload = {
        zoneId: selectedZone,
        exportScope: selectedParcelIds.length > 0 ? 'SELECTED_LIST' : 'FILTER_CRITERIA',
        selectedReportIds: selectedParcelIds,
        exportFormat: 'PDF_BOOK_COMPILATION',
        includeGisOverviewMap: true,
        includeEcsSummaryTable: true,
        filterCriteria: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        },
      };

      const res = await api.post('/reports/batch-export', payload);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setBatchResult({
          batchCode: d.batchCode || d.batch_code || `BATCH-${selectedZone}-${Date.now()}`,
          downloadUrl: d.downloadUrl || d.download_url || '#',
          checksumSha256: d.checksumSha256 || d.checksum_sha256 || '',
          totalReportsCompiled: d.totalReportsCompiled || d.total_reports_compiled || (selectedParcelIds.length || filteredParcels.length),
          expiresAt: d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('vi-VN') : new Date(Date.now() + 7 * 86400000).toLocaleDateString('vi-VN'),
        });
        setActionMessage({
          type: 'success',
          text: `Đóng gói mẻ xuất thành công! Tổng cộng ${d.totalReportsCompiled || d.total_reports_compiled || selectedParcelIds.length} hồ sơ đã được tích hợp.`,
        });
      } else {
        throw new Error(res.data?.message || 'Máy chủ không phản hồi kết quả mẻ xuất.');
      }
    } catch (err: any) {
      console.error('[BatchExport] Error executing batch export:', err);
      setBatchResult(null);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Không thể tạo mẻ xuất hồ sơ. Vui lòng kiểm tra quyền Zone Admin hoặc thử lại.',
      });
    } finally {
      setIsBatchExporting(false);
    }
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
    isBatchExporting,
    batchResult,
    setBatchResult,
    fetchExportableParcels,
    toggleSelectAll,
    toggleSelectParcel,
    handleCreateBatchExport,
  };
};
