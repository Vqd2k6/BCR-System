import React, { useState } from 'react';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { Trash2, AlertTriangle, CheckCircle2, ShieldAlert, X, Database } from 'lucide-react';
import { userService } from '../../../services/userService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (stats: any) => void;
}

export const CleanResetModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    if (confirmText.trim() !== 'RESET_CLEAN_DB') {
      setError('Vui lòng nhập chính xác từ khóa "RESET_CLEAN_DB" để xác nhận');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await userService.cleanResetDatabase();
      if (res && res.success) {
        onSuccess(res.stats);
        onClose();
      } else {
        setError(res?.message || 'Có lỗi xảy ra khi dọn sạch DB');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể kết nối đến máy chủ để thực hiện dọn sạch DB'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-red-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-100 bg-red-50/60">
          <div className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-sm">Dọn Sạch DB & Chuẩn Hóa Mã Lô Ban Đầu</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-red-900">CẢNH BÁO QUAN TRỌNG TỪ HỆ THỐNG</p>
              <p className="mt-1 leading-relaxed">
                Hành động này sẽ dọn sạch toàn bộ dữ liệu khảo sát và trả cơ sở dữ liệu về trạng thái
                nguyên bản (Pure Baseline) để chuẩn bị cho đợt khảo sát thực tế.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-700">
            <p className="font-bold text-slate-800">Quy trình thực hiện bao gồm:</p>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Bảo tồn 100% thửa đất (1,643 thửa)</strong> và 22 phân khu/ga Metro 2.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Đánh số chuẩn chỉnh toàn bộ mã lô</strong> theo phân đoạn quy hoạch (ví dụ: <code className="bg-slate-200 px-1 py-0.5 rounded text-emerald-800 font-mono text-[11px]">C&C-01-B-0001</code>).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Reset trạng thái</strong> toàn bộ thửa đất về <code>CHƯA KHẢO SÁT</code>, xóa mọi liên kết báo cáo.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Trash2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>
                <strong>Xóa sạch 100% hồ sơ khảo sát</strong> (Phase 1, Phase 2, ảnh hiện trường, khiếm khuyết, biên bản, chấm công).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Dọn tài khoản:</strong> Xóa toàn bộ tài khoản thử nghiệm, chỉ giữ lại duy nhất 1 tài khoản <strong>superadmin</strong> (mật khẩu: <code className="bg-slate-200 px-1 rounded font-mono font-bold text-slate-800">Admin@123</code>) để cấp mới cho Surveyor.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-slate-700 font-semibold mb-1.5">
              Nhập mã xác nhận để kích hoạt thao tác: <span className="font-mono text-red-600 font-bold select-all">RESET_CLEAN_DB</span>
            </label>
            <Input
              type="text"
              placeholder="Nhập chính xác: RESET_CLEAN_DB"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              className="font-mono text-center font-bold tracking-wider"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100/80 border border-red-300 rounded-lg text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Hủy bỏ
          </Button>
          <Button
            size="sm"
            onClick={handleExecuteReset}
            disabled={confirmText.trim() !== 'RESET_CLEAN_DB' || isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-bold"
            icon={<Trash2 size={14} className={isLoading ? 'animate-spin' : ''} />}
          >
            {isLoading ? 'Đang dọn sạch DB...' : 'Xác Nhận Dọn Sạch DB'}
          </Button>
        </div>
      </div>
    </div>
  );
};
