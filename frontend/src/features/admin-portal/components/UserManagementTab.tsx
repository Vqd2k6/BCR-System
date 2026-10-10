import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  Shield,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  type AdminUser,
  userService,
} from '../../../services/userService';
import { UserEditModal } from './UserEditModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { METRO_22_ZONES } from '../../survey-phase1/constants/metroGisConstants';
import { useAuth } from '../../../context/AuthContext';

export const UserManagementTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Modals state
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AdminUser | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);

  // Feedback banner
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await userService.listUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        zoneId: zoneFilter !== 'ALL' ? zoneFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });

      if (res && res.data) {
        setUsers(res.data);
        setTotal(res.pagination?.total ?? res.data.length);
      }
    } catch (err: unknown) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
      setUsers([]);
      setTotal(0);
      setBannerMsg({
        type: 'error',
        text: getErrorMessage(err, 'Không thể kết nối đến máy chủ để tải danh sách tài khoản'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, zoneFilter, statusFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (user.id === currentUser?.id) {
      alert('Bạn không thể tự khóa tài khoản của chính mình!');
      return;
    }

    const nextStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    const actionName = nextStatus === 'ACTIVE' ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Bạn có chắc muốn ${actionName} tài khoản [${user.username}]?`)) return;

    try {
      await userService.updateStatus(user.id, nextStatus, `Thao tác bởi Quản trị viên lúc ${new Date().toLocaleTimeString()}`);
      setBannerMsg({ type: 'success', text: `Đã ${actionName} thành công tài khoản [${user.username}]` });
      fetchUsers();
    } catch (err: unknown) {
      setBannerMsg({
        type: 'error',
        text: getErrorMessage(err, `Không thể ${actionName} tài khoản`),
      });
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (user.id === currentUser?.id) {
      alert('Bạn không thể tự vô hiệu hóa tài khoản của chính mình!');
      return;
    }

    if (!window.confirm(`Xác nhận vô hiệu hóa tài khoản [${user.username}]? Toàn bộ hồ sơ khảo sát đã lập sẽ được bảo tồn an toàn.`)) return;

    try {
      await userService.deleteUser(user.id);
      setBannerMsg({ type: 'success', text: `Đã vô hiệu hóa tài khoản [${user.username}] thành công` });
      fetchUsers();
    } catch (err: unknown) {
      setBannerMsg({
        type: 'error',
        text: getErrorMessage(err, 'Không thể xóa tài khoản'),
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge variant="danger">Lãnh đạo MAUR (Super Admin)</Badge>;
      case 'ZONE_ADMIN':
        return <Badge variant="warning">Tổ Trưởng Zone</Badge>;
      case 'SURVEYOR':
        return <Badge variant="info">Khảo Sát Hiện Trường</Badge>;
      case 'GUEST':
        return <Badge variant="neutral">Chủ Đầu Tư (Guest)</Badge>;
      case 'CONTRACTOR':
        return <Badge variant="purple">Nhà Thầu / Đối tác</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success" dot>Hoạt động</Badge>;
      case 'SUSPENDED':
        return <Badge variant="warning" dot>Tạm ngưng</Badge>;
      case 'LOCKED':
        return <Badge variant="danger" dot>Đã khóa</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <Card className="border-slate-200">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">
              Quản Trị Người Dùng & Phân Quyền Vai Trò
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {total} tài khoản
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cấp tài khoản, phân bổ Ga/Zone phụ trách, cấp lại mật khẩu và kiểm soát trạng thái nhân sự tuyến Metro 2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setSelectedUserForEdit(null);
              setIsEditModalOpen(true);
            }}
            icon={<UserPlus size={14} />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            + Cấp tài khoản mới
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchUsers}
            icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            disabled={isLoading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Banner thông báo */}
      {bannerMsg && (
        <div
          className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center justify-between ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{bannerMsg.text}</span>
          </div>
          <button onClick={() => setBannerMsg(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {/* Tìm kiếm */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Tìm theo tên, username, SĐT, mã KSV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
        </form>

        {/* Lọc Role */}
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Tất cả Vai trò</option>
          <option value="SUPER_ADMIN">Lãnh đạo MAUR (Super Admin)</option>
          <option value="ZONE_ADMIN">Tổ Trưởng Zone</option>
          <option value="SURVEYOR">Khảo Sát Hiện Trường</option>
          <option value="GUEST">Chủ Đầu Tư (Guest)</option>
          <option value="CONTRACTOR">Nhà Thầu / Khách</option>
        </select>

        {/* Lọc Zone */}
        <select
          value={zoneFilter}
          onChange={(e) => {
            setZoneFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Tất cả Ga / Phân khu</option>
          {METRO_22_ZONES.map((z) => (
            <option key={z.code} value={z.code}>
              {z.name} ({z.code})
            </option>
          ))}
        </select>

        {/* Lọc Trạng thái */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">Tất cả Trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="SUSPENDED">Tạm ngưng</option>
          <option value="LOCKED">Đã khóa</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
            <tr>
              <th className="p-3">Họ và tên cán bộ</th>
              <th className="p-3">Tài khoản & Mã KSV</th>
              <th className="p-3">Vai trò phân quyền</th>
              <th className="p-3">Phân khu / Ga phụ trách</th>
              <th className="p-3 text-center">Trạng thái</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-emerald-600" />
                  <span>Đang tải danh sách người dùng...</span>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <span>Không tìm thấy tài khoản nào khớp với bộ lọc</span>
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const fullName = u.fullName || u.full_name || '---';
                const assignedZone = u.assignedZoneId || u.assigned_zone_id;
                const surveyorCode = u.surveyorCode || u.surveyor_code;
                const isSelf = u.id === currentUser?.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{fullName}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                            (Bạn)
                          </span>
                        )}
                      </div>
                      {u.phone && (
                        <div className="text-[11px] font-normal text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-semibold text-slate-700">{u.username}</div>
                      {surveyorCode && (
                        <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 bg-sky-50 text-sky-700 border border-sky-200 rounded">
                          ID: {surveyorCode}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{getRoleBadge(u.role)}</td>
                    <td className="p-3">
                      {u.role === 'SUPER_ADMIN' || assignedZone === 'ALL' || assignedZone === 'ALL_ZONES' ? (
                        <span className="font-semibold text-emerald-700">Toàn tuyến (22 Zones)</span>
                      ) : assignedZone ? (
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <MapPin size={12} className="text-sky-600 flex-shrink-0" />
                          <span>{assignedZone}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa phân bổ</span>
                      )}
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(u.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Sửa thông tin */}
                        <button
                          title="Chỉnh sửa thông tin"
                          onClick={() => {
                            setSelectedUserForEdit(u);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Đổi mật khẩu */}
                        <button
                          title="Đặt lại mật khẩu"
                          onClick={() => {
                            setSelectedUserForPassword(u);
                            setIsPasswordModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <KeyRound size={14} />
                        </button>

                        {/* Khóa/Mở khóa */}
                        <button
                          title={
                            isSelf
                              ? 'Không thể tự khóa tài khoản của chính mình'
                              : u.status === 'ACTIVE'
                              ? 'Khóa tài khoản'
                              : 'Mở khóa tài khoản'
                          }
                          disabled={isSelf}
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelf
                              ? 'opacity-30 cursor-not-allowed text-slate-400'
                              : u.status === 'ACTIVE'
                              ? 'text-slate-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-red-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>

                        {/* Xóa/Vô hiệu hóa */}
                        <button
                          title={isSelf ? 'Không thể tự vô hiệu hóa tài khoản của chính mình' : 'Vô hiệu hóa tài khoản'}
                          disabled={isSelf}
                          onClick={() => handleDeleteUser(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelf
                              ? 'opacity-30 cursor-not-allowed text-slate-400'
                              : 'text-slate-400 hover:text-red-700 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Thanh Phân Trang (Pagination Controls) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
          <div>
            <span>
              Hiển thị từ <strong>{total === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> đến{' '}
              <strong>{Math.min(currentPage * pageSize, total)}</strong> trong tổng số <strong>{total}</strong> tài khoản
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isLoading}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors"
            >
              <ChevronLeft size={13} />
              <span>Trước</span>
            </button>

            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || isLoading}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors"
            >
              <span>Sau</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit / Create User Modal */}
      <UserEditModal
        isOpen={isEditModalOpen}
        user={selectedUserForEdit}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setBannerMsg({
            type: 'success',
            text: selectedUserForEdit ? 'Cập nhật tài khoản thành công!' : 'Cấp mới tài khoản thành công!',
          });
          fetchUsers();
        }}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={isPasswordModalOpen}
        user={selectedUserForPassword}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => {
          setBannerMsg({
            type: 'success',
            text: `Đã đổi mật khẩu thành công cho tài khoản ${selectedUserForPassword?.username}!`,
          });
        }}
      />
    </Card>
  );
};
