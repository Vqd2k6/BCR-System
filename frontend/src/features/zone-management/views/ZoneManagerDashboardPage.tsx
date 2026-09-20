import React, { useState } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Users, MapPin, CheckCircle2, Clock, AlertTriangle, Filter, Download } from 'lucide-react';

export const ZoneManagerDashboardPage: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState('ZONE_S9');

  const stats = {
    totalParcels: 320,
    completed: 185,
    inProgress: 45,
    absent: 30,
    notSurveyed: 60,
  };

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
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-800"
          >
            <option value="ZONE_S9">Khu vực Ga S9 (Bảy Hiền - Tân Bình)</option>
            <option value="ZONE_S10">Khu vực Ga S10 (Phạm Văn Hai)</option>
            <option value="ZONE_S11">Khu vực Ga S11 (Dân Chủ)</option>
          </select>

          <Button size="sm" variant="outline" icon={<Download className="w-4 h-4" />}>
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* 4 Thống kê tiến độ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tổng số thửa đất</span>
          <span className="text-2xl font-black text-slate-800">{stats.totalParcels}</span>
          <div className="mt-2 text-xs text-slate-500">100% ranh quy hoạch</div>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <span className="text-xs font-bold text-emerald-700 uppercase block mb-1">Đã hoàn thành</span>
          <span className="text-2xl font-black text-emerald-800">{stats.completed}</span>
          <div className="mt-2 text-xs text-emerald-600 font-bold">
            {((stats.completed / stats.totalParcels) * 100).toFixed(1)}% tiến độ
          </div>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <span className="text-xs font-bold text-amber-700 uppercase block mb-1">Đang khảo sát</span>
          <span className="text-2xl font-black text-amber-800">{stats.inProgress}</span>
          <div className="mt-2 text-xs text-amber-600">Đang thực hiện hiện trường</div>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <span className="text-xs font-bold text-red-700 uppercase block mb-1">Vắng mặt / Khó tiếp cận</span>
          <span className="text-2xl font-black text-red-800">{stats.absent}</span>
          <div className="mt-2 text-xs text-red-600">Cần liên hệ lại lần 2</div>
        </Card>
      </div>

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
