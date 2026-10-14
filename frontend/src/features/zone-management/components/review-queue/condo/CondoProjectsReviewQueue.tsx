import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { PendingSubmissionItem } from '../ZoneAuditReviewQueue';
import { CondoTowerMasterCard } from './CondoTowerMasterCard';
import { CondoTowerUnitQueue } from './CondoTowerUnitQueue';

interface Props {
  selectedZone: string;
  onOpenStudio: (reportId: string | null) => void;
  onPreviewReport: (reportId: string | null) => void;
  onOpenRejectModal: (item: PendingSubmissionItem) => void;
  onOpenReassignModal: (item: PendingSubmissionItem) => void;
  onOpenMutationModal: (item: PendingSubmissionItem) => void;
  onOpenReshapeModal?: (item: PendingSubmissionItem) => void;
  onOpenAuditHistory: (reportId: string, itemCode?: string) => void;
  onStatsNeedRefresh?: () => void;
}

export const CondoProjectsReviewQueue: React.FC<Props> = ({
  selectedZone,
  onOpenStudio,
  onPreviewReport,
  onOpenRejectModal,
  onOpenReassignModal,
  onOpenMutationModal,
  onOpenReshapeModal,
  onOpenAuditHistory,
  onStatsNeedRefresh,
}) => {
  const [selectedTowerParcelId, setSelectedTowerParcelId] = useState<string | null>(null);
  const [selectedTowerItem, setSelectedTowerItem] = useState<PendingSubmissionItem | null>(null);
  const [towerItems, setTowerItems] = useState<PendingSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTowerInput, setSearchTowerInput] = useState('');

  const fetchTowers = async () => {
    if (!selectedZone) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/condo/towers', {
        params: {
          zoneId: selectedZone,
        },
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        setTowerItems(res.data.data);
      } else {
        setTowerItems([]);
      }
    } catch (err: unknown) {
      console.error('[CondoProjectsReviewQueue] Lỗi tải danh sách tháp chung cư:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTowers();
  }, [selectedZone]);

  const handleSelectTower = (parcelId: string, item: PendingSubmissionItem) => {
    setSelectedTowerParcelId(parcelId);
    setSelectedTowerItem(item);
  };

  const filteredTowers = useMemo(() => {
    if (!searchTowerInput.trim()) return towerItems;
    const q = searchTowerInput.toLowerCase().trim();
    return towerItems.filter((t) => {
      const matchCode = (t.project_parcel_code || '').toLowerCase().includes(q);
      const matchHouse = (t.house_number || '').toLowerCase().includes(q);
      const matchStreet = (t.street || '').toLowerCase().includes(q);
      return matchCode || matchHouse || matchStreet;
    });
  }, [towerItems, searchTowerInput]);

  // If a tower is drilled-down, render Level 2: CondoTowerUnitQueue
  if (selectedTowerParcelId && selectedTowerItem) {
    return (
      <CondoTowerUnitQueue
        towerParcelId={selectedTowerParcelId}
        towerItem={selectedTowerItem}
        onBackToTowers={() => {
          setSelectedTowerParcelId(null);
          setSelectedTowerItem(null);
          fetchTowers();
        }}
        onOpenStudio={onOpenStudio}
        onPreviewReport={onPreviewReport}
        onOpenRejectModal={onOpenRejectModal}
        onOpenReassignModal={onOpenReassignModal}
        onOpenMutationModal={onOpenMutationModal}
        onOpenReshapeModal={onOpenReshapeModal}
        onOpenAuditHistory={onOpenAuditHistory}
        onStatsNeedRefresh={onStatsNeedRefresh}
      />
    );
  }

  // Level 1: Tower Master Cards Grid
  return (
    <div className="space-y-4">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTowerInput}
            onChange={(e) => setSearchTowerInput(e.target.value)}
            placeholder="Tìm theo tên tháp, mã tòa, địa chỉ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="text-slate-800 dark:text-slate-200">{filteredTowers.length}</strong> khối tháp
          </div>

          <button
            type="button"
            onClick={fetchTowers}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Làm mới danh sách tòa"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-2xl border border-red-200 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={fetchTowers} className="font-bold underline cursor-pointer hover:opacity-80">
            Thử lại
          </button>
        </div>
      )}

      {/* Grid of Tower Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold">Đang tải danh sách các khối tháp chung cư...</span>
        </div>
      ) : filteredTowers.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700" />
          <span className="font-bold text-sm text-slate-600 dark:text-slate-400">
            Không tìm thấy dự án chung cư nào trong phân khu này
          </span>
          <p className="text-xs text-slate-400 max-w-sm">
            Phân khu này không có tòa nhà chung cư mẹ hoặc các khối tháp chưa được phân loại vào cơ sở dữ liệu GIS.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTowers.map((tower) => (
            <CondoTowerMasterCard
              key={tower.parcel_id}
              tower={tower}
              onSelectTower={handleSelectTower}
              onOpenMasterStudio={onOpenStudio}
            />
          ))}
        </div>
      )}
    </div>
  );
};
