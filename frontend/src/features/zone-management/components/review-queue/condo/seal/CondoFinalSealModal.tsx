import React, { useState } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Building2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { api } from '../../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export interface CondoBlockingItem {
  id: string;
  unitCode: string;
  unitType: string;
  floorNumber: number | null;
  status: string;
  reportId: string | null;
  reason: string;
}

interface CondoFinalSealModalProps {
  isOpen: boolean;
  parcelId: string;
  projectParcelCode: string;
  buildingName: string;
  masterReportId: string | null;
  masterReportStatus: string;
  totalItems: number;
  completedItems: number;
  isReadyForFinalSeal: boolean;
  blockingItems: CondoBlockingItem[];
  onClose: () => void;
  onSuccess: () => void;
  onOpenReportStudio?: (reportId: string) => void;
}

export const CondoFinalSealModal: React.FC<CondoFinalSealModalProps> = ({
  isOpen,
  parcelId,
  projectParcelCode,
  buildingName,
  masterReportId,
  masterReportStatus,
  totalItems,
  completedItems,
  isReadyForFinalSeal,
  blockingItems,
  onClose,
  onSuccess,
  onOpenReportStudio,
}) => {
  const [sealNotes, setSealNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sealedResult, setSealedResult] = useState<{
    sealHash: string;
    lockedAt: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleExecuteSeal = async () => {
    if (!isReadyForFinalSeal) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/admin/condo/${parcelId}/final-seal`, {
        sealNotes: sealNotes.trim() || undefined,
      });
      if (res.data?.success && res.data.data) {
        setSealedResult({
          sealHash: res.data.data.sealHash,
          lockedAt: res.data.data.lockedAt,
        });
        onSuccess();
      } else {
        setErrorMsg(res.data?.message || 'Không thể thực thi khóa sổ pháp lý.');
      }
    } catch (err: unknown) {
      console.error('[CondoFinalSealModal] Error executing final seal:', err);
      setErrorMsg(getErrorMessage(err, 'Lỗi kết nối khi thực thi khóa sổ pháp lý.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] isolate flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative z-[121] w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Niêm Phong &amp; Khóa Sổ Pháp Lý Toàn Khối Tháp (SHA-256)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                {buildingName} • Mã thửa: {projectParcelCode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {sealedResult ? (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 space-y-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                ĐÃ NIÊM PHONG &amp; KHÓA SỔ PHÁP LÝ TOÀN TÒA THÀNH CÔNG!
              </div>
              <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] break-all border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-1">MÃ BĂM MẬT MÃ HỌC SHA-256:</div>
                {sealedResult.sealHash}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          ) : (
            <>
              {/* Checklist 2 điều kiện tiên quyết */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className={`p-3.5 rounded-xl border ${
                    masterReportStatus === 'APPROVED'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      1. Hồ sơ Tòa nhà mẹ (Master)
                    </span>
                    {masterReportStatus === 'APPROVED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                        ĐÃ DUYỆT
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                        {masterReportStatus || 'CHƯA DUYỆT'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                    Hồ sơ thông số gốc 5 bước của khối tháp (Quy mô, Hạng móng CAT, Lún nghiêng, ECS/VI/BRA).
                  </p>
                  {masterReportId && masterReportStatus !== 'APPROVED' && onOpenReportStudio && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReportStudio(masterReportId);
                      }}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Mở thẩm định Hồ sơ Tòa Mẹ</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    completedItems === totalItems && totalItems > 0
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      2. Khu vực chung &amp; Căn hộ con
                    </span>
                    <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300">
                      {completedItems} / {totalItems} mục
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                    100% phân vùng dùng chung (M-xxx) và căn hộ con (U-xxx) phải đạt APPROVED hoặc POSTPONED_ABSENT_VERIFIED.
                  </p>
                </div>
              </div>

              {/* Danh sách Blocking Items nếu chưa đủ điều kiện */}
              {blockingItems.length > 0 && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-2">
                  <div className="font-black text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Đang còn {blockingItems.length} hạng mục chưa hoàn tất thẩm định (Chặn khóa sổ):
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {blockingItems.map((item) => (
                      <div
                        key={`${item.id}_${item.unitCode}`}
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                              {item.unitCode}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600">
                              {item.status}
                            </span>
                            {item.floorNumber !== null && (
                              <span className="text-[10px] text-slate-500">
                                Tầng {item.floorNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                            {item.reason}
                          </div>
                        </div>

                        {item.reportId && onOpenReportStudio && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenReportStudio(item.reportId!);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            Thẩm định ngay
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ô nhập ghi chú niêm phong khi đủ điều kiện */}
              {isReadyForFinalSeal && (
                <div className="space-y-2 pt-1">
                  <label className="block font-bold text-slate-800 dark:text-slate-200">
                    Biên bản / Ghi chú Niêm phong Pháp lý Khối tháp (Tùy chọn):
                  </label>
                  <textarea
                    rows={3}
                    value={sealNotes}
                    onChange={(e) => setSealNotes(e.target.value)}
                    placeholder="Nhập ghi chú nghiệm thu tổng thể tòa nhà trước khi khóa sổ bất biến SHA-256..."
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Lưu ý pháp lý:</strong> Sau khi bấm{' '}
                      <em>Ký Số &amp; Khóa Sổ Pháp Lý</em>, hệ thống sẽ sinh chữ ký băm mật mã học{' '}
                      <strong>SHA-256</strong> trên toàn bộ Hồ sơ Tòa Mẹ và {totalItems} căn hộ/khu vực dùng chung, chuyển toàn bộ khối tháp sang trạng thái khóa bất biến.
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!sealedResult && (
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={!isReadyForFinalSeal || submitting}
              onClick={handleExecuteSeal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>Ký Số SHA-256 &amp; Khóa Sổ Toàn Tòa</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

