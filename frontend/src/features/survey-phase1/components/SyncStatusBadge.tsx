import React, { useState } from 'react';
import { Cloud, RefreshCw, AlertTriangle, UserCheck, ShieldAlert, WifiOff } from 'lucide-react';

interface SyncStatusBadgeProps {
  syncStatus: 'IDLE' | 'SYNCING' | 'SAVED' | 'OFFLINE' | 'ERROR';
  lastSyncedAt: string | null;
  isDirty?: boolean;
  onManualSync?: () => void;
  onReleaseLock?: () => void;
  disabled?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  syncStatus,
  lastSyncedAt,
  isDirty = false,
  onManualSync,
  onReleaseLock,
  disabled = false,
}) => {
  const [showHandoverConfirm, setShowHandoverConfirm] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const handleConfirmRelease = async () => {
    if (!onReleaseLock) return;
    setIsReleasing(true);
    try {
      await onReleaseLock();
      setShowHandoverConfirm(false);
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Badge Trạng thái Đồng bộ */}
      {syncStatus === 'SYNCING' && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span>Đang đồng bộ...</span>
        </div>
      )}

      {syncStatus === 'SAVED' && (
        <div
          title={lastSyncedAt ? `Đã lưu lên máy chủ lúc ${lastSyncedAt}` : 'Đã đồng bộ lên máy chủ'}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs shrink-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden md:inline">Máy chủ:</span>
          <span className="font-mono text-[11px] sm:text-xs">{lastSyncedAt ? `${lastSyncedAt}` : 'Đã lưu'}</span>
        </div>
      )}

      {syncStatus === 'OFFLINE' && (
        <div
          title="Dữ liệu khảo sát được bảo vệ trọn vẹn trong bộ nhớ máy (IndexedDB). Sẽ tự động tải lên máy chủ khi kết nối sẵn sàng."
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300 shadow-xs shrink-0"
        >
          <WifiOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Lưu cục bộ</span>
        </div>
      )}

      {syncStatus === 'ERROR' && (
        <div
          title="Đồng bộ máy chủ bị gián đoạn. Dữ liệu khảo sát vẫn được lưu an toàn 100% trên máy. Bấm 'Lưu tạm' để thử lại."
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 shadow-xs cursor-pointer hover:bg-amber-100 transition-colors shrink-0"
          onClick={onManualSync}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="hidden sm:inline">Chưa đồng bộ</span>
          <span className="sm:hidden">Thử lại</span>
        </div>
      )}

      {/* Nút Bấm Lưu Tạm Thủ Công */}
      {onManualSync && !disabled && (
        <button
          type="button"
          onClick={onManualSync}
          disabled={syncStatus === 'SYNCING'}
          title="Bấm để lưu tạm bản nháp lên máy chủ ngay lập tức"
          className={`inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium transition-all shadow-xs shrink-0 cursor-pointer ${
            isDirty
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Lưu tạm</span>
        </button>
      )}

      {/* Nút Bàn Giao Ca / Nghỉ Ca */}
      {onReleaseLock && !disabled && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowHandoverConfirm(true)}
            title="Kết thúc ca làm việc hoặc mở khóa để đồng đội ca sau tiếp quản ngay"
            className="inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden lg:inline">Bàn giao ca</span>
          </button>

          {/* Modal / Popover xác nhận Bàn giao ca */}
          {showHandoverConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-3 text-amber-600">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200">
                    <UserCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Bàn Giao Ca Làm Việc?</h4>
                    <p className="text-xs text-slate-500">Mở khóa để đồng đội làm tiếp</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Khi bạn bấm xác nhận, hệ thống sẽ lưu toàn bộ tiến độ hiện tại lên máy chủ và **mở khóa tức thì**. Kỹ sư ca tiếp theo có thể nhập mã tiếp quản để khảo sát tiếp mà không cần chờ 15 phút.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowHandoverConfirm(false)}
                    disabled={isReleasing}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRelease}
                    disabled={isReleasing}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    {isReleasing && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>Xác nhận mở khóa</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
