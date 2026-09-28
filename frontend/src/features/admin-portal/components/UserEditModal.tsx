import React, { useState, useEffect } from 'react';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import {
  UserPlus,
  UserCheck,
  X,
  AlertCircle,
  Shield,
  MapPin,
  Upload,
  Trash2,
  FileSignature,
} from 'lucide-react';
import { AdminUser, userService, CreateUserPayload, UpdateUserPayload } from '../../../services/userService';
import { METRO_22_ZONES } from '../../survey-phase1/constants/metroGisConstants';

interface Props {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const UserEditModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const isCreate = !user;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR'>('SURVEYOR');
  const [assignedZoneId, setAssignedZoneId] = useState<string>('ZONE_01');
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.role);
      setAssignedZoneId(user.assignedZoneId || 'ZONE_01');
      setSignatureImageUrl(user.signatureImageUrl || null);
      setPassword('');
    } else {
      setUsername('');
      setPassword('');
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('SURVEYOR');
      setAssignedZoneId('ZONE_01');
      setSignatureImageUrl(null);
    }
    setError(null);
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Tính toán trước mã định danh Surveyor ID (P-XXXX) từ 4 số cuối của SĐT
  const digits = phone.replace(/\D/g, '');
  const previewSurveyorCode = digits.length >= 4 ? `P-${digits.slice(-4)}` : null;

  // Xử lý upload ảnh chữ ký số mẫu bởi Admin
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh (PNG, JPG, JPEG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Dung lượng ảnh chữ ký tối đa là 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSignatureImageUrl(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Họ và tên không được để trống');
      return;
    }

    if (isCreate) {
      if (!username.trim() || username.length < 3) {
        setError('Tên đăng nhập phải từ 3 ký tự');
        return;
      }
      if (!password || password.length < 6) {
        setError('Mật khẩu khởi tạo phải từ 6 ký tự trở lên');
        return;
      }
    }

    if (role === 'SURVEYOR' && (!phone || phone.replace(/\D/g, '').length < 8)) {
      setError('Đối với Khảo sát viên hiện trường, Số điện thoại bắt buộc phải có ít nhất 8 số để tự động sinh mã pháp lý P-XXXX.');
      return;
    }

    const effectiveZoneId = role === 'SUPER_ADMIN' || role === 'CONTRACTOR' ? null : assignedZoneId;

    setIsLoading(true);
    try {
      if (isCreate) {
        const payload: CreateUserPayload = {
          username: username.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role,
          assignedZoneId: effectiveZoneId,
          signatureImageUrl: signatureImageUrl || null,
        };
        await userService.createUser(payload);
      } else {
        const payload: UpdateUserPayload = {
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role,
          assignedZoneId: effectiveZoneId,
          signatureImageUrl: signatureImageUrl || null,
        };
        await userService.updateUser(user!.id, payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu thông tin người dùng');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDesc = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'Toàn quyền cấu hình hệ thống, quản lý tài khoản, xem và xuất báo cáo toàn tuyến (22 Phân đoạn).';
      case 'ZONE_ADMIN':
        return 'Quản trị nhân sự và kiểm duyệt hồ sơ khảo sát của Phân khu/Ga được phân công.';
      case 'SURVEYOR':
        return 'Cán bộ hiện trường: Điểm danh GPS, nhập số liệu khảo sát 8 bước, chụp ảnh và lấy chữ ký.';
      case 'CONTRACTOR':
        return 'Nhà thầu/Khách tra cứu: Chỉ xem bản đồ tiến độ thi công và tra cứu hồ sơ hiện trạng đã duyệt.';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            {isCreate ? (
              <UserPlus className="w-5 h-5 text-emerald-600" />
            ) : (
              <UserCheck className="w-5 h-5 text-sky-600" />
            )}
            <h3 className="font-bold text-sm">
              {isCreate ? 'Cấp Mới Tài Khoản Hệ Thống' : `Cập Nhật Tài Khoản: ${user?.username}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Họ và tên cán bộ *"
              placeholder="VD: Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Số điện thoại liên hệ *"
              placeholder="VD: 0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={role === 'SURVEYOR'}
            />
          </div>

          {/* Surveyor ID Preview Badge */}
          {role === 'SURVEYOR' && (
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-800 block">
                  MÃ ĐỊNH DANH PHÁP LÝ (SURVEYOR ID):
                </span>
                <span className="text-[10px] text-sky-600">
                  Tự động sinh theo quy chuẩn Metro 2: <code>P-XXXX</code> (4 số cuối SĐT)
                </span>
              </div>
              <span className="px-2.5 py-1 bg-white border border-sky-300 rounded-lg font-mono font-black text-sm text-sky-700 shadow-xs">
                {previewSurveyorCode || 'P-____'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Tên đăng nhập (Username) *"
              placeholder="VD: surveyor_s1_01"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!isCreate}
              required
            />

            {isCreate ? (
              <Input
                label="Mật khẩu ban đầu *"
                type="password"
                placeholder="Tối thiểu 6 ký tự..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            ) : (
              <Input
                label="Email thông báo"
                type="email"
                placeholder="VD: canbo@maur.gov.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </div>

          {/* Vai trò (Role) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Shield size={14} className="text-emerald-600" />
              <span>Vai trò & Phân quyền truy cập *</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
            >
              <option value="SURVEYOR">Điều Tra Viên Hiện Trường (SURVEYOR)</option>
              <option value="ZONE_ADMIN">Tổ Trưởng Phân Khu (ZONE_ADMIN)</option>
              <option value="SUPER_ADMIN">Lãnh Đạo Ban MAUR (SUPER_ADMIN)</option>
              <option value="CONTRACTOR">Đại Diện Nhà Thầu / Khách (CONTRACTOR)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
              💡 {getRoleDesc(role)}
            </p>
          </div>

          {/* Phân bổ Zone */}
          {(role === 'ZONE_ADMIN' || role === 'SURVEYOR') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin size={14} className="text-sky-600" />
                <span>Ga / Phân khu Zone phụ trách *</span>
              </label>
              <select
                value={assignedZoneId}
                onChange={(e) => setAssignedZoneId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-sm"
              >
                <optgroup label="⭐ 5 Phân đoạn dữ liệu chuẩn">
                  {METRO_22_ZONES.filter((z) => z.isDataReady).map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tất cả 22 Phân đoạn toàn tuyến">
                  {METRO_22_ZONES.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Quản lý Chữ Ký Số Pháp Lý (Chỉ Admin cấp và kiểm duyệt) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileSignature size={14} className="text-emerald-600" />
              <span>Ảnh Chữ Ký Số Pháp Lý Của Cán Bộ (Do Admin cấp & kiểm duyệt)</span>
            </label>

            {signatureImageUrl ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-28 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={signatureImageUrl}
                      alt="Chữ ký"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-700 block">Đã có chữ ký số mẫu</span>
                    <span className="text-[10px] text-slate-500">Chữ ký sẽ tự động chèn vào Báo cáo & Biên bản hiện trường</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSignatureImageUrl(null)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa chữ ký"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleSignatureUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload size={20} className="mx-auto mb-1 text-slate-400" />
                <span className="text-xs font-bold text-slate-700 block">
                  Bấm để tải file ảnh chữ ký (PNG trong suốt hoặc JPG rõ nét)
                </span>
                <span className="text-[10px] text-slate-400">
                  Dung lượng tối đa 2MB. KSV không thể tự ý sửa đổi chữ ký này.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {isCreate ? 'Cấp tài khoản mới' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
