import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMessage(null);
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPasswordStrength = (pwd: string): { label: string; level: number; colorClass: string } => {
    if (!pwd) return { label: 'Chưa nhập', level: 0, colorClass: 'bg-slate-300' };
    if (pwd.length < 6) return { label: 'Chưa đủ 6 ký tự', level: 1, colorClass: 'bg-rose-500' };
    let score = 1;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score >= 3) return { label: 'Mạnh (Khuyến nghị)', level: 3, colorClass: 'bg-emerald-500' };
    return { label: 'Hợp lệ (Đạt chuẩn >= 6 ký tự)', level: 2, colorClass: 'bg-sky-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại của bạn.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    try {
      setIsSubmitting(true);
      await changePassword(currentPassword, newPassword, confirmPassword);
      setIsSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1600);
    } catch (err: unknown) {
      console.error('[ChangePasswordModal:handleSubmit] Lỗi đổi mật khẩu:', err);
      setErrorMessage(getErrorMessage(err, 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <KeyRound size={19} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 m-0">
                Đổi Mật Khẩu Bảo Mật Tài Khoản
              </h3>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                Tài khoản: <span className="font-mono font-bold text-sky-700">{user?.username}</span>
                {user?.surveyorCode ? ` (${user.surveyorCode})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 transition-all cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 flex items-start gap-2.5 text-xs text-sky-900 leading-relaxed">
            <ShieldCheck size={16} className="text-sky-600 shrink-0 mt-0.5" />
            <div>
              Sau khi đổi mật khẩu, các thiết bị khác sẽ tự động đăng xuất để bảo vệ tài khoản, trong khi <strong>phiên làm việc hiện tại của bạn vẫn được giữ nguyên</strong>.
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-3.5 py-2.5 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Đổi mật khẩu thành công! Phiên làm việc hiện tại được giữ nguyên.</span>
            </div>
          )}

          {/* Mật khẩu hiện tại */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mật khẩu hiện tại (Do Admin cấp hoặc đang dùng) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                autoComplete="current-password"
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 bg-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                title={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Mật khẩu mới */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <KeyRound size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (>= 6 ký tự)..."
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 bg-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                title={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden flex gap-1">
                  <div className={`h-full transition-all ${strength.level >= 1 ? strength.colorClass : 'bg-transparent'}`} style={{ width: `${(strength.level / 3) * 100}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 shrink-0">{strength.label}</span>
              </div>
            )}
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Xác nhận mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <KeyRound size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 bg-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                title={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="flex-[1.6] py-2.5 px-4 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
            >
              {isSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

