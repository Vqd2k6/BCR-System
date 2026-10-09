import React, { useState } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { ShieldCheck, Users, Settings, FileSpreadsheet, Database, Lock, Search, Split } from 'lucide-react';
import { Phase1ExportModuleBox } from '../../zone-management/components/Phase1ExportModuleBox';
import { UserManagementTab } from '../components/UserManagementTab';
import { AdminGisMutationTab } from '../components/AdminGisMutationTab';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'gis-mutation' | 'users' | 'audit' | 'config'>('export');

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
        {([
          { key: 'export', label: 'Xuất Báo Cáo Phase 1 (BCS Export Module Box)', icon: <FileSpreadsheet className="w-4 h-4" /> },
          { key: 'gis-mutation', label: 'Biên Tập Ranh & Tách/Gộp Thửa GIS', icon: <Split className="w-4 h-4" /> },
          { key: 'users', label: 'Quản lý Người dùng & Phân quyền', icon: <Users className="w-4 h-4" /> },
          { key: 'audit', label: 'Nhật Ký Hệ Thống (Audit Logs)', icon: <Database className="w-4 h-4" /> },
          { key: 'config', label: 'Cấu Hình Tham Số BRA & Metro', icon: <Settings className="w-4 h-4" /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
        <Phase1ExportModuleBox initialZoneId="ALL" />
      )}

      {/* Tab GIS Mutation Studio */}
      {activeTab === 'gis-mutation' && (
        <AdminGisMutationTab />
      )}

      {/* Tab Users: Dynamic UserManagementTab */}
      {activeTab === 'users' && (
        <UserManagementTab />
      )}

      {/* Tab Audit */}
      {activeTab === 'audit' && (
        <Card>
          <div className="p-8 text-center">
            <Database className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-800">Nhật Ký Thẩm Định & Kiểm Toán Dữ Liệu</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Toàn bộ lịch sử nộp hồ sơ, chữ ký số hiện trường, tính toán mã băm SHA-256 bất biến và các cảnh báo bất thường GPS được lưu trữ tại phân hệ Audit Log của Backend.
            </p>
          </div>
        </Card>
      )}

      {/* Tab Config */}
      {activeTab === 'config' && (
        <Card>
          <div className="p-8 text-center">
            <Settings className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-800">Tham Số Ma Trận Kỹ Thuật Tuyến Metro Số 2</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Hệ thống đang áp dụng Tiêu chuẩn phân cấp nứt Burland 1977 và Ma trận đánh giá rủi ro cơ sở BRA (Building Risk Assessment) $V \times I$ theo quy chuẩn Liên danh CRLG-CRSRI-TT.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

