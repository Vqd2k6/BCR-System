import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  FileDiff,
  KeyRound,
} from 'lucide-react';
import { api } from '../../../../services/api';

export interface DiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode?: string;
  diffItems: DiffItem[];
  updatesPayload: Record<string, any>;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuditDiffConfirmModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  diffItems,
  updatesPayload,
  onClose,
  onSuccess,
}) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản Zone Admin của bạn.');
      return;
    }
    if (!editReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do điều chỉnh hồ sơ để ghi nhận vào nhật ký kiểm toán.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.put(`/admin/reports/${reportId}/audit-edit`, {
        adminPassword: adminPassword.trim(),
        editReason: editReason.trim(),
        diffPayload: diffItems,
        updates: updatesPayload,
      });

      if (res.data?.success || res.status === 200) {
        alert('Đã lưu chỉnh sửa và ghi nhận vào Nhật ký kiểm toán thành công!');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể lưu thay đổi.');
      }
    } catch (err: any) {
      console.error('[AuditDiffConfirmModal] Error saving audit edits:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Lỗi xác thực khi lưu chỉnh sửa.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayValue = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400 italic font-mono">(Trống / Không có)</span>;
    }
    if (typeof val === 'boolean') {
      return val ? 'Có (True)' : 'Không (False)';
    }
    if (typeof val === 'object') {
      return <span className="font-mono text-[11px]">{JSON.stringify(val)}</span>;
    }
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <FileDiff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Đối Chiếu Sai Khác & Xác Thực Mật Khẩu</span>
                {parcelCode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-mono font-normal">
                    {parcelCode}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rà soát các trường thông tin thay đổi so với dữ liệu gốc của Khảo Sát Viên trước khi ghi nhận pháp lý.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Diff Summary Count */}
          <div className="flex items-center justify-between text-xs text-slate-600 pb-1">
            <span className="font-bold">
              Phát hiện <strong className="text-amber-600">{diffItems.length}</strong> trường thông tin được điều chỉnh:
            </span>
            <span className="text-[11px] text-slate-400">
              Màu đỏ: Dữ liệu gốc &bull; Màu xanh: Dữ liệu mới
            </span>
          </div>

          {/* Diff Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-3 w-1/4">Trường Thông Tin</th>
                  <th className="p-3 w-[37.5%]">Giá Trị Ban Đầu (KSV Nộp)</th>
                  <th className="p-3 w-[37.5%]">Giá Trị Mới (Admin Sửa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diffItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-slate-400">
                      Không có trường nào bị thay đổi.
                    </td>
                  </tr>
                ) : (
                  diffItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">
                        <div>{item.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.field}</div>
                      </td>
                      <td className="p-3 bg-red-50/50 text-red-800 font-medium">
                        <span className="line-through opacity-80">{formatDisplayValue(item.oldValue)}</span>
                      </td>
                      <td className="p-3 bg-emerald-50/60 text-emerald-800 font-bold">
                        <span>{formatDisplayValue(item.newValue)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Lý do điều chỉnh thông tin <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-slate-400 font-normal">Ghi nhận vào system_audit_logs</span>
            </label>
            <textarea
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Ví dụ: Chuẩn hóa lại số nhà theo CCCD chủ hộ; Cập nhật độ sâu móng theo bản vẽ hoàn công..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Admin Password Input */}
          <div className="space-y-1.5 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
            <label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Xác Thực Bằng Mật Khẩu Zone Admin <span className="text-red-600">*</span></span>
            </label>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Dữ liệu khảo sát là căn cứ pháp lý bồi thường. Bắt buộc nhập mật khẩu đăng nhập của bạn để chứng thực quyền sửa đổi và khóa trách nhiệm pháp lý.
            </p>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Nhập mật khẩu tài khoản Zone Admin của bạn..."
                className="w-full pl-3 pr-10 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mã hóa bảo vệ tính toàn vẹn dữ liệu Metro 2</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Quay lại chỉnh sửa
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || diffItems.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang xác thực & Lưu...' : 'Xác Nhận & Lưu Chính Thức 🔒'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
