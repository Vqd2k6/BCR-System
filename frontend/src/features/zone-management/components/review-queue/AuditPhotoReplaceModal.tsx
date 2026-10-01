import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  Upload,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  KeyRound,
  Lock,
} from 'lucide-react';
import { api } from '../../../../services/api';

interface Props {
  isOpen: boolean;
  reportId: string;
  targetPhotoType: string; // 'DEFECT_CU' | 'ZONE_CTX' | 'IDENTIFICATION_P' | 'OTHER'
  targetPhotoId?: string;  // e.g. 'D-01' or 'photoP01'
  defectId?: string;
  zoneId?: string;
  photoIndex?: number;
  currentPhotoUrl: string;
  photoTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuditPhotoReplaceModal: React.FC<Props> = ({
  isOpen,
  reportId,
  targetPhotoType,
  targetPhotoId,
  defectId,
  zoneId,
  photoIndex = 0,
  currentPhotoUrl,
  photoTitle = 'Ảnh Hiện Trường',
  onClose,
  onSuccess,
}) => {
  // Sinh mã 6 số ngẫu nhiên cho riêng lần điều chỉnh này
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [replacementReason, setReplacementReason] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const generateNewRandomPin = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    setGeneratedPin(String(random));
    setEnteredPin('');
  };

  useEffect(() => {
    if (isOpen) {
      generateNewRandomPin();
      setNewPhotoUrl('');
      setReplacementReason('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xử lý upload ảnh mới
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chỉ chọn tệp hình ảnh (.jpg, .jpeg, .png).');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload qua endpoint storage
      const res = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data?.data?.url) {
        setNewPhotoUrl(res.data.data.url);
      } else if (res.data?.url) {
        setNewPhotoUrl(res.data.url);
      } else {
        // Fallback đọc DataURL nếu backend storage offline
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setNewPhotoUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.warn('[AuditPhotoReplaceModal] Error uploading file, using direct preview:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setNewPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPhotoUrl.trim()) {
      setErrorMsg('Vui lòng chọn hoặc tải lên bức ảnh mới để thay thế.');
      return;
    }

    if (enteredPin.trim() !== generatedPin) {
      setErrorMsg(`Mã xác nhận không khớp! Vui lòng nhập chính xác mã 6 chữ số: ${generatedPin}`);
      return;
    }

    if (!replacementReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do kỹ thuật bắt buộc khi thay thế ảnh hiện trường.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.post(`/admin/reports/${reportId}/audit-replace-photo`, {
        targetPhotoType,
        targetPhotoId,
        defectId,
        zoneId,
        photoIndex,
        newPhotoUrl,
        clientPin: enteredPin.trim(),
        replacementReason: replacementReason.trim(),
      });

      if (res.data?.success || res.status === 200) {
        alert('Đã thay thế ảnh và lưu vết kiểm toán an toàn thành công!');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể thay thế ảnh.');
      }
    } catch (err: any) {
      console.error('[AuditPhotoReplaceModal] Error replacing photo:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi xác thực khi thay thế ảnh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPinMatched = enteredPin.trim() === generatedPin && generatedPin.length === 6;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Thay Thế Ảnh Hiện Trường &bull; Kiểm Soát Bảo Mật</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {photoTitle} &bull; Yêu cầu xác thực mã 6 số ngẫu nhiên cho từng ảnh được điều chỉnh.
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* So sánh trực tiếp 2 ảnh */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ảnh hiện tại */}
            <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-600 mb-1.5 self-start flex items-center gap-1">
                <span>Ảnh hiện tại (Gốc KSV)</span>
              </span>
              <div className="w-full h-36 rounded-lg bg-black/10 overflow-hidden flex items-center justify-center relative">
                {currentPhotoUrl ? (
                  <img
                    src={currentPhotoUrl}
                    alt="Current"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-400 italic">Chưa có ảnh</span>
                )}
              </div>
            </div>

            {/* Ảnh mới thay thế */}
            <div className="border border-sky-200 rounded-xl p-2.5 bg-sky-50/40 flex flex-col items-center">
              <span className="text-[11px] font-bold text-sky-800 mb-1.5 self-start flex items-center justify-between w-full">
                <span>Ảnh mới thay thế</span>
                {newPhotoUrl && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Đã chọn
                  </span>
                )}
              </span>
              <div className="w-full h-36 rounded-lg bg-white border border-dashed border-sky-300 overflow-hidden flex items-center justify-center relative">
                {newPhotoUrl ? (
                  <img
                    src={newPhotoUrl}
                    alt="New Replacement"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-sky-50 transition-colors p-2 text-center">
                    <Upload className="w-6 h-6 text-sky-600 mb-1" />
                    <span className="text-xs font-bold text-sky-700">Tải ảnh mới lên</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG (Có thước đo mm)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {newPhotoUrl && (
                <label className="text-[11px] text-sky-600 hover:underline cursor-pointer mt-1 self-start">
                  Đổi ảnh khác...
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Lý do thay thế bắt buộc */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Lý do thay thế ảnh hiện trường <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-slate-400 font-normal">Lưu vết vào system_audit_logs</span>
            </label>
            <textarea
              rows={2}
              value={replacementReason}
              onChange={(e) => setReplacementReason(e.target.value)}
              placeholder="Ví dụ: Ảnh cũ chụp bị lóa vạch thước đo nứt mm, thay bằng ảnh chụp bổ sung lúc 10:30..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Khối bảo mật sinh mã 6 số ngẫu nhiên */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">Mã Xác Thực Ngẫu Nhiên 6 Số (Mỗi ảnh 1 lần):</span>
              </div>
              <button
                type="button"
                onClick={generateNewRandomPin}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
                title="Đổi mã ngẫu nhiên khác"
              >
                <RefreshCw className="w-3 h-3" /> Đổi mã khác
              </button>
            </div>

            {/* Khung hiển thị mã ngẫu nhiên to rõ */}
            <div className="py-2.5 px-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center gap-3">
              {generatedPin.split('').map((digit, i) => (
                <span
                  key={i}
                  className="w-9 h-11 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-400 font-mono font-black text-xl flex items-center justify-center shadow-md select-none tracking-wider"
                >
                  {digit}
                </span>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              Nhập chính xác 6 chữ số trên vào ô bên dưới để chứng thực bạn đã kiểm tra kỹ lưỡng trước khi thay thế chứng cứ hiện trường:
            </p>

            {/* Ô nhập mã xác thực */}
            <div className="max-w-xs mx-auto">
              <input
                type="text"
                maxLength={6}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập đúng 6 chữ số..."
                className={`w-full py-2 px-3 rounded-xl bg-white text-slate-900 font-mono font-black text-center text-lg tracking-widest focus:outline-none border-2 transition-all ${
                  isPinMatched
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                    : enteredPin.length === 6
                    ? 'border-red-500'
                    : 'border-slate-300 focus:border-amber-400'
                }`}
              />
              {isPinMatched && (
                <div className="text-center text-[11px] text-emerald-400 font-bold mt-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mã bảo mật chính xác!
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !isPinMatched || !newPhotoUrl || isUploading}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Đang lưu vết...' : 'Xác Nhận Thay Ảnh Này 🔒'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
