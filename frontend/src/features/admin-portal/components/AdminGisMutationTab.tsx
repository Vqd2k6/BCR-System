import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import {
  Split,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Layers,
  History,
  Info,
} from 'lucide-react';
import { api } from '../../../services/api';
import { METRO_22_ZONES, getZoneByCode } from '../../survey-phase1/constants/metroGisConstants';
import { UnifiedGisMutationModal } from '../../../components/gis/cadastral-editor/UnifiedGisMutationModal';
import { GisParcel } from '../../../components/gis/shared/types';

export const AdminGisMutationTab: React.FC = () => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('ZONE_09');
  const [parcels, setParcels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SURVEYED' | 'NOT_SURVEYED' | 'DEPRECATED'>('ALL');

  // Mutation Modal State
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchParcels = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/parcels/zone-map', {
        params: { zoneId: selectedZoneId },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setParcels(res.data.data);
      } else {
        setParcels([]);
      }
    } catch (err: any) {
      console.error('[AdminGisMutationTab] Fetch error:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách thửa đất của phân khu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, [selectedZoneId]);

  // Normalize parcel data
  const normalizedParcels = useMemo(() => {
    return parcels.map((p) => {
      const projectParcelCode = p.project_parcel_code || p.projectParcelCode || '';
      const officialCadastralCode = p.official_cadastral_code || p.officialCadastralCode || '';
      const houseNumber = p.house_number || p.houseNumber || '';
      const street = p.street || '';
      const ownerName = p.owner_name || p.ownerName || '';
      const surveyStatus = p.survey_status || p.surveyStatus || 'NOT_SURVEYED';
      const landArea = Number(p.land_area_m2 || p.landArea || 0);
      const floorCount = Number(p.floor_count || p.floorCount || 1);
      const buildingType = p.building_type || p.buildingType || 'STANDALONE';

      return {
        ...p,
        projectParcelCode,
        officialCadastralCode,
        houseNumber,
        street,
        ownerName,
        surveyStatus,
        landArea,
        floorCount,
        buildingType,
      };
    });
  }, [parcels]);

  // Filtered parcels
  const filteredParcels = useMemo(() => {
    return normalizedParcels.filter((p) => {
      // Search term
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesCode = p.projectParcelCode.toLowerCase().includes(query) || p.officialCadastralCode.toLowerCase().includes(query);
        const matchesAddress = p.houseNumber.toLowerCase().includes(query) || p.street.toLowerCase().includes(query);
        const matchesOwner = p.ownerName.toLowerCase().includes(query);
        if (!matchesCode && !matchesAddress && !matchesOwner) return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE') {
        if (p.surveyStatus === 'SPLIT_DEPRECATED' || p.surveyStatus === 'MERGED_DEPRECATED') return false;
      } else if (statusFilter === 'SURVEYED') {
        if (p.surveyStatus !== 'SURVEYED') return false;
      } else if (statusFilter === 'NOT_SURVEYED') {
        if (p.surveyStatus !== 'NOT_SURVEYED' && p.surveyStatus !== 'SCHEDULED' && p.surveyStatus !== 'IN_PROGRESS') return false;
      } else if (statusFilter === 'DEPRECATED') {
        if (p.surveyStatus !== 'SPLIT_DEPRECATED' && p.surveyStatus !== 'MERGED_DEPRECATED') return false;
      }

      return true;
    });
  }, [normalizedParcels, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    let surveyed = 0;
    let notSurveyed = 0;
    let deprecated = 0;
    normalizedParcels.forEach((p) => {
      if (p.surveyStatus === 'SPLIT_DEPRECATED' || p.surveyStatus === 'MERGED_DEPRECATED') {
        deprecated++;
      } else if (p.surveyStatus === 'SURVEYED') {
        surveyed++;
      } else {
        notSurveyed++;
      }
    });
    return {
      total: normalizedParcels.length,
      surveyed,
      notSurveyed,
      deprecated,
    };
  }, [normalizedParcels]);

  const zoneInfo = getZoneByCode(selectedZoneId);

  const handleOpenMutation = (parcel: any) => {
    setSelectedParcel(parcel);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert / Toast */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-bold animate-in fade-in ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header Info & Zone Picker */}
      <Card>
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-100 text-sky-800 rounded-xl">
              <Split className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-800">
                  Trung Tâm Quản Trị & Biến Động Thửa Đất GIS (Super Admin Cadastral Studio)
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  👑 Super Admin Master Authority
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Công cụ kiểm soát ranh địa chính PostGIS, biên tập đỉnh polygon, tách thửa (nhà mới/đất dôi dư) và gộp thửa cho toàn bộ 22 phân khu Metro Line 2.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <MapPin className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-700">Phân khu:</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="text-xs font-black bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-sky-500"
              >
                {METRO_22_ZONES.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchParcels}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Stats in Selected Zone */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50/60 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Thửa Trong Zone</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats.total}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{zoneInfo?.name || selectedZoneId}</span>
        </Card>

        <Card className="p-4 bg-emerald-50/40 border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Đã Khảo Sát</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2">{stats.surveyed}</p>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Hồ sơ Phase 1 hoàn tất</span>
        </Card>

        <Card className="p-4 bg-amber-50/40 border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Chưa Khảo Sát</span>
            <Building className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-800 mt-2">{stats.notSurveyed}</p>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Chờ thực địa</span>
        </Card>

        <Card className="p-4 bg-purple-50/40 border-purple-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Lịch Sử Biến Động</span>
            <History className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-800 mt-2">{stats.deprecated}</p>
          <span className="text-[11px] text-purple-600 mt-0.5 block">Đã tách / gộp (Lưu vết)</span>
        </Card>
      </div>

      {/* Filter Bar & Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã thửa, địa chỉ, chủ sở hữu..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 bg-slate-50 focus:bg-white text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Lọc:
            </span>
            {[
              { key: 'ALL', label: 'Tất cả' },
              { key: 'ACTIVE', label: 'Đang hoạt động' },
              { key: 'SURVEYED', label: 'Đã khảo sát' },
              { key: 'NOT_SURVEYED', label: 'Chưa khảo sát' },
              { key: 'DEPRECATED', label: 'Lịch sử biến động' },
            ].map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setStatusFilter(btn.key as any)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === btn.key
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Parcels Table */}
      <Card className="overflow-hidden border-slate-200">
        {errorMsg && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Mã Thửa Dự Án</th>
                <th className="py-3 px-4">Địa Chỉ Công Trình</th>
                <th className="py-3 px-4">Chủ Sở Hữu</th>
                <th className="py-3 px-4 text-right">Diện Tích (m²)</th>
                <th className="py-3 px-4 text-center">Tầng / Loại</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                    <span>Đang nạp dữ liệu địa chính PostGIS...</span>
                  </td>
                </tr>
              ) : filteredParcels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>Không tìm thấy thửa đất nào phù hợp với bộ lọc.</span>
                  </td>
                </tr>
              ) : (
                filteredParcels.map((p) => {
                  const isDeprecated =
                    p.surveyStatus === 'SPLIT_DEPRECATED' || p.surveyStatus === 'MERGED_DEPRECATED';

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-sky-50/40 transition-colors ${
                        isDeprecated ? 'bg-slate-50/60 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 flex items-center gap-1.5">
                          <span>{p.projectParcelCode}</span>
                          {p.officialCadastralCode && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({p.officialCadastralCode})
                            </span>
                          )}
                        </div>
                        {isDeprecated && (
                          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-700 border border-purple-200">
                            {p.surveyStatus === 'SPLIT_DEPRECATED' ? 'Đã Tách Thửa' : 'Đã Gộp Thửa'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {p.houseNumber} {p.street}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">{p.ownerName || 'Chưa cập nhật'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-slate-800">
                          {p.landArea ? p.landArea.toLocaleString('vi-VN') : '0'} m²
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-slate-600 font-medium">
                          {p.floorCount}T • {p.buildingType === 'STANDALONE' ? 'Nhà riêng' : p.buildingType === 'CONDOMINIUM' ? 'Chung cư' : 'Khác'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.surveyStatus === 'SURVEYED' ? (
                          <Badge variant="success">Đã Khảo Sát</Badge>
                        ) : p.surveyStatus === 'IN_PROGRESS' ? (
                          <Badge variant="warning">Đang Khảo Sát</Badge>
                        ) : isDeprecated ? (
                          <Badge variant="neutral">Lưu trữ</Badge>
                        ) : (
                          <Badge variant="neutral">Chưa Khảo Sát</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isDeprecated}
                          onClick={() => handleOpenMutation(p)}
                          className="flex items-center gap-1.5 ml-auto text-xs py-1.5 px-3 bg-sky-600 hover:bg-sky-700"
                          title={isDeprecated ? 'Thửa đất đã biến động, dữ liệu được bảo toàn dạng lịch sử' : 'Mở Studio Biên Tập Ranh & Tách/Gộp Thửa'}
                        >
                          <Split className="w-3.5 h-3.5" />
                          <span>Tách / Gộp Thửa</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Unified GIS Mutation Studio Modal */}
      {isModalOpen && selectedParcel && (
        <UnifiedGisMutationModal
          isOpen={isModalOpen}
          parcelId={selectedParcel.id}
          initialParcel={selectedParcel}
          initialZoneId={selectedZoneId}
          parcelCode={selectedParcel.projectParcelCode}
          houseNumber={selectedParcel.houseNumber}
          street={selectedParcel.street}
          currentAreaM2={selectedParcel.landArea}
          role="SUPER_ADMIN"
          onClose={() => {
            setIsModalOpen(false);
            setSelectedParcel(null);
          }}
          onSuccess={(msg) => {
            setIsModalOpen(false);
            setSelectedParcel(null);
            setBannerMsg({ type: 'success', text: msg });
            fetchParcels();
          }}
        />
      )}
    </div>
  );
};
