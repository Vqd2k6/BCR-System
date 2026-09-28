import React, { useState, useEffect } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Users, MapPin, CheckCircle2, Clock, AlertTriangle, Filter, Download, RefreshCw, BarChart3, Building } from 'lucide-react';
import { Phase1ExportModuleBox } from '../components/Phase1ExportModuleBox';
import { METRO_22_ZONES, getZoneByCode } from '../../survey-phase1/constants/metroGisConstants';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/api';

export const ZoneManagerDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const resolveDefaultZone = (zoneId?: string | null): string => {
    if (!zoneId) return 'ZONE_01';
    const upper = zoneId.toUpperCase().trim();
    if (upper === 'ALL' || upper === 'ALL_ZONES') return 'ALL';
    const matched = getZoneByCode(upper);
    if (matched && matched.isDataReady) return matched.code;
    return 'ZONE_01';
  };

  const [selectedZone, setSelectedZone] = useState<string>(() => {
    return resolveDefaultZone(user?.assignedZoneId);
  });

  const [stats, setStats] = useState({
    totalParcels: 0,
    approved: 0,
    submitted: 0,
    inProgress: 0,
    absent: 0,
    notSurveyed: 0,
  });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const fetchLiveStats = async (zone: string) => {
    setIsStatsLoading(true);
    try {
      const res = await api.get('/admin/analytics/progress', {
        params: { zoneId: zone },
      });
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setStats({
          totalParcels: Number(d.total_parcels || 0),
          approved: Number(d.approved_count || 0),
          submitted: Number(d.submitted_count || 0),
          inProgress: Number(d.in_progress_count || 0),
          absent: Number(d.absent_count || 0),
          notSurveyed: Number(d.not_surveyed_count || 0),
        });
      }
    } catch (e) {
      console.warn('[ZoneManager] Failed to fetch live analytics:', e);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats(selectedZone);
  }, [selectedZone]);

  const surveyors = [
    { id: '1', name: 'Nguyễn Văn Khảo Sát', assigned: 80, completed: 55, activeNow: true },
    { id: '2', name: 'Trần Kỹ Thuật', assigned: 90, completed: 62, activeNow: true },
    { id: '3', name: 'Lê Hiện Trường', assigned: 75, completed: 40, activeNow: false },
    { id: '4', name: 'Phạm Đo Đạc', assigned: 75, completed: 28, activeNow: true },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Phân hệ Quản trị Khu vực
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Dashboard Trưởng Zone / Điều Phối Viên</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tiến độ khảo sát thực tế, thẩm định hồ sơ và phê duyệt xuất báo cáo hiện trường.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">🌐 Tất cả các Phân khu (Toàn tuyến Metro 2 - 1.227 thửa)</option>
            <optgroup label="⭐ 5 Phân đoạn dữ liệu chuẩn (Đã có khảo sát)">
              {METRO_22_ZONES.filter((z) => z.isDataReady).map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name} ({z.rawParcelCount} thửa)
                </option>
              ))}
            </optgroup>
            <optgroup label="Tất cả 22 Phân đoạn toàn tuyến">
              {METRO_22_ZONES.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={() => fetchLiveStats(selectedZone)}
            disabled={isStatsLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            title="Làm mới chỉ số tiến độ"
          >
            <RefreshCw size={15} className={isStatsLoading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* 4 Thống kê tiến độ thực tế từ Database */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tổng số thửa đất</span>
          <span className="text-2xl font-black text-slate-800">{stats.totalParcels}</span>
          <div className="mt-2 text-xs text-slate-500">100% ranh quy hoạch khu vực</div>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <span className="text-xs font-bold text-emerald-700 uppercase block mb-1">Đã phê duyệt (Approved)</span>
          <span className="text-2xl font-black text-emerald-800">{stats.approved}</span>
          <div className="mt-2 text-xs text-emerald-600 font-bold">
            {stats.totalParcels > 0
              ? `${((stats.approved / stats.totalParcels) * 100).toFixed(1)}% hoàn thành`
              : '0% hoàn thành'}
          </div>
        </Card>

        <Card className="border-sky-200 bg-sky-50/50">
          <span className="text-xs font-bold text-sky-700 uppercase block mb-1">Chờ duyệt (Submitted)</span>
          <span className="text-2xl font-black text-sky-800">{stats.submitted}</span>
          <div className="mt-2 text-xs text-sky-600">Đã nộp từ hiện trường</div>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <span className="text-xs font-bold text-amber-700 uppercase block mb-1">Đang khảo sát dở</span>
          <span className="text-2xl font-black text-amber-800">{stats.inProgress}</span>
          <div className="mt-2 text-xs text-amber-600">
            {stats.absent > 0 ? `+ ${stats.absent} vắng mặt` : 'Khảo sát viên đang làm'}
          </div>
        </Card>
      </div>

      {/* 1. Primary Feature Module Box: Export Report Phase 1 */}
      <Phase1ExportModuleBox initialZoneId={selectedZone} key={selectedZone} />

      {/* Bảng phân công nhân sự khảo sát */}
      <Card>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <span>Tiến Độ Nhân Sự Khảo Sát Trong Zone</span>
          </h2>
          <Button size="sm" variant="outline">+ Phân công thêm thửa</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Cán bộ khảo sát</th>
                <th className="p-3 text-center">Trạng thái GPS</th>
                <th className="p-3 text-center">Số thửa giao</th>
                <th className="p-3 text-center">Đã hoàn thành</th>
                <th className="p-3 text-center">Tỷ lệ</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surveyors.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800">{s.name}</td>
                  <td className="p-3 text-center">
                    <Badge variant={s.activeNow ? 'success' : 'default'} dot>
                      {s.activeNow ? 'Đang online hiện trường' : 'Offline'}
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">{s.assigned} thửa</td>
                  <td className="p-3 text-center font-bold text-emerald-700">{s.completed} thửa</td>
                  <td className="p-3 text-center">
                    <div className="w-24 bg-slate-200 h-2 rounded-full mx-auto overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${(s.completed / s.assigned) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost">Xem chi tiết</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
