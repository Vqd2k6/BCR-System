import React, { useState } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { ShieldCheck, Users, Settings, FileSpreadsheet, Database, Lock, Search } from 'lucide-react';
import { Phase1ExportModuleBox } from '../../zone-management/components/Phase1ExportModuleBox';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'export' | 'audit' | 'config'>('export');

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Super Administrator Control Center
          </span>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 mt-1">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            <span>Trung Tâm Quản Trị Hệ Thống Metro Khảo Sát</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" dot>Hệ thống hoạt động bình thường</Badge>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'export', label: 'Xuất Báo Cáo Phase 1 (BCS Export Module Box)', icon: <FileSpreadsheet className="w-4 h-4" /> },
          { key: 'users', label: 'Quản lý Người dùng & Phân quyền', icon: <Users className="w-4 h-4" /> },
          { key: 'audit', label: 'Nhật Ký Hệ Thống (Audit Logs)', icon: <Database className="w-4 h-4" /> },
          { key: 'config', label: 'Cấu Hình Tham Số BRA & Metro', icon: <Settings className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border ${
              activeTab === tab.key
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Export: Phase1ExportModuleBox */}
      {activeTab === 'export' && (
        <Phase1ExportModuleBox initialZoneId="ZONE_S9" />
      )}

      {/* Tab Users */}
      {activeTab === 'users' && (
        <Card>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">Danh Sách Tài Khoản & Vai Trò</h2>
              <p className="text-xs text-slate-500">Phân quyền Surveyor, Trưởng Zone, Ban Quản lý Metro</p>
            </div>
            <Button size="sm">+ Thêm tài khoản mới</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">Tên đăng nhập</th>
                  <th className="p-3">Vai trò</th>
                  <th className="p-3">Zone được gán</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800">Nguyễn Văn Khảo Sát</td>
                  <td className="p-3 text-slate-600 font-mono">surveyor_01</td>
                  <td className="p-3"><Badge variant="info">SURVEYOR</Badge></td>
                  <td className="p-3 font-semibold text-slate-700">ZONE_S9 (Bảy Hiền)</td>
                  <td className="p-3 text-center"><Badge variant="success">Hoạt động</Badge></td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost">Sửa</Button></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800">Trần Trưởng Zone</td>
                  <td className="p-3 text-slate-600 font-mono">zoneadmin_s9</td>
                  <td className="p-3"><Badge variant="warning">ZONE_ADMIN</Badge></td>
                  <td className="p-3 font-semibold text-slate-700">ZONE_S9 (Bảy Hiền)</td>
                  <td className="p-3 text-center"><Badge variant="success">Hoạt động</Badge></td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost">Sửa</Button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
