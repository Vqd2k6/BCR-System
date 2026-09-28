import React, { useState } from 'react';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { KeyRound, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminUser, userService } from '../../../services/userService';

interface Props {
  isOpen: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetPasswordModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    try {
      await userService.resetPassword(user.id, newPassword);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể đặt lại mật khẩu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <KeyRound className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm">Đặt Lại Mật Khẩu Tài Khoản</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            Đang đổi mật khẩu cho tài khoản: <strong>{user.fullName}</strong> ({user.username})
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Mật khẩu mới"
            type="password"
            placeholder="Ít nhất 6 ký tự..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            placeholder="Nhập lại mật khẩu..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={isLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
