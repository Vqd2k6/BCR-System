import React, { useState } from 'react';
import {
  X,
  History,
  ShieldCheck,
  User,
  Clock,
  Globe,
  FileDiff,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Camera,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export interface AuditHistoryLogItem {
  id: string;
  action: string;
  performedByName: string;
  performedByRole: string;
  createdAt: string;
  clientIp?: string;
  editReason?: string;
  diff?: Array<{
    field: string;
    label: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  rawPayload?: {
    oldPhotoUrl?: string;
    newPhotoUrl?: string;
    [key: string]: unknown;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reportCode?: string;
  parcelCode?: string;
  logs: AuditHistoryLogItem[];
}

export const AuditHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  reportCode,
  parcelCode,
  logs = [],
}) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(
    logs.length > 0 ? logs[0].id : null
  );

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'ZONE_ADMIN_SURVEY_EDIT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-200 flex items-center gap-1">
            <FileDiff className="w-3.5 h-3.5 text-amber-600" />
            <span>Điều chỉnh thông số khảo sát</span>
          </span>
        );
      case 'ZONE_ADMIN_REPLACE_PHOTO':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 border border-blue-200 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>Thay thế ảnh hiện trường</span>
          </span>
        );
      case 'SPATIAL_GEOMETRY_SWAP':
      case 'REASSIGN_PARCEL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 border border-purple-200 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Biến động / Hoán đổi thửa đất GIS</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const formatDisplayValue = (val: unknown) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">
                  Nhật Ký Kiểm Toán & Truy Vết Chỉnh Sửa
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Append-Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hồ sơ: <strong className="text-sky-300">{reportCode || parcelCode || 'Hồ sơ khảo sát'}</strong> • Tổng cộng {logs.length} lượt can thiệp được ghi nhận
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center gap-2">
              <ShieldCheck className="w-12 h-12 text-slate-300" />
              <p className="font-bold text-sm text-slate-600">
                Hồ sơ này chưa có bất kỳ can thiệp hay chỉnh sửa nào từ Quản trị viên
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                Dữ liệu hiện tại hoàn toàn nguyên bản theo biên bản khảo sát hiện trường do Kỹ sư khảo sát ghi nhận.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => {
                const isExpanded = expandedLogId === log.id;
                const diffList = log.diff || [];
                const dDate = new Date(log.createdAt);

                return (
                  <div
                    key={log.id || index}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                  >
                    {/* Log Entry Header */}
                    <div
                      onClick={() => toggleExpand(log.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-white hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-200">
                          #{logs.length - index}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getActionBadge(log.action)}
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{log.performedByName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                {log.performedByRole}
                              </span>
                            </div>
                          </div>

                          {log.editReason && (
                            <p className="text-xs text-slate-600 mt-1 italic line-clamp-1">
                              &ldquo;{log.editReason}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right text-[11px] text-slate-500">
                          <div className="flex items-center gap-1 justify-end font-semibold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {dDate.toLocaleDateString('vi-VN')} {dDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          {log.clientIp && (
                            <div className="flex items-center gap-1 justify-end text-slate-400 text-[10px] mt-0.5">
                              <Globe className="w-3 h-3" />
                              <span>IP: {log.clientIp}</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detailed Accordion */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                        {/* Meta Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Lý do điều chỉnh:</span>
                            <span className="text-slate-800 font-medium">
                              {log.editReason || 'Không có lý do cụ thể'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Hình thức xác thực:</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mật khẩu Zone Admin (Đã xác minh)</span>
                            </span>
                          </div>
                        </div>

                        {/* Diff List */}
                        {diffList.length > 0 ? (
                          <div>
                            <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                              Danh sách {diffList.length} trường dữ liệu đã thay đổi:
                            </span>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold">
                                    <th className="py-2 px-3 w-1/3">Trường dữ liệu</th>
                                    <th className="py-2 px-3 w-1/3 text-amber-700 bg-amber-50/50">Giá trị KSV nhập ban đầu</th>
                                    <th className="py-2 px-3 w-1/3 text-emerald-700 bg-emerald-50/50">Giá trị Admin điều chỉnh mới</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {diffList.map((df, dfIdx) => (
                                    <tr key={dfIdx} className="hover:bg-slate-50">
                                      <td className="py-2 px-3 font-semibold text-slate-800">
                                        <div>{df.label || df.field}</div>
                                        <div className="text-[10px] font-mono text-slate-400">{df.field}</div>
                                      </td>
                                      <td className="py-2 px-3 text-slate-600 bg-amber-50/20 font-mono text-[11px]">
                                        {formatDisplayValue(df.oldValue)}
                                      </td>
                                      <td className="py-2 px-3 font-bold text-emerald-700 bg-emerald-50/20 font-mono text-[11px]">
                                        {formatDisplayValue(df.newValue)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : log.rawPayload?.newPhotoUrl ? (
                          <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                            <span className="font-bold text-slate-700 block">Thay thế ảnh hiện trường:</span>
                            <div className="flex items-center gap-4">
                              {log.rawPayload.oldPhotoUrl && (
                                <div className="text-center">
                                  <span className="text-[10px] text-slate-400 block mb-1">Ảnh ban đầu:</span>
                                  <img
                                    src={log.rawPayload.oldPhotoUrl}
                                    alt="Ảnh ban đầu"
                                    className="w-24 h-24 object-cover rounded border border-slate-200"
                                  />
                                </div>
                              )}
                              <span className="text-slate-400 font-bold">➜</span>
                              <div className="text-center">
                                <span className="text-[10px] text-emerald-600 font-bold block mb-1">Ảnh thay thế:</span>
                                <img
                                  src={log.rawPayload.newPhotoUrl}
                                  alt="Ảnh thay thế"
                                  className="w-24 h-24 object-cover rounded border border-emerald-300"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Tất cả các bản ghi kiểm toán đều được mã hóa và lưu trữ bất biến.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
