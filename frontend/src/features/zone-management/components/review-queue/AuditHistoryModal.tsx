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
  XCircle,
  ClipboardCheck,
  Lock,
  UserX,
  FileText,
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
  rawPayload?: Record<string, unknown>;
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
      case 'SURVEYOR_SUBMIT_REPORT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-700 border border-teal-200 flex items-center gap-1">
            <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Nộp biên bản khảo sát hiện trường</span>
          </span>
        );
      case 'ZONE_ADMIN_APPROVE_REPORT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Phê duyệt hồ sơ</span>
          </span>
        );
      case 'ZONE_ADMIN_REJECT_REPORT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Yêu cầu khảo sát lại (Trả về)</span>
          </span>
        );
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
      case 'CONDO_FINAL_LEGAL_SEAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-700 border border-indigo-200 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Niêm phong pháp lý tòa nhà mẹ</span>
          </span>
        );
      case 'APPROVE_ABSENTEE_VERIFIED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-700 border border-violet-200 flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-violet-600" />
            <span>Xác nhận hồ sơ vắng mặt hợp lệ</span>
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

  const getAuthBadge = (action: string) => {
    switch (action) {
      case 'SURVEYOR_SUBMIT_REPORT':
        return (
          <span className="text-teal-700 font-bold flex items-center gap-1">
            <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Kỹ sư khảo sát hiện trường (Chữ ký & GPS)</span>
          </span>
        );
      case 'ZONE_ADMIN_APPROVE_REPORT':
        return (
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Chữ ký số Thẩm định viên (Đã duyệt)</span>
          </span>
        );
      case 'ZONE_ADMIN_REJECT_REPORT':
        return (
          <span className="text-rose-700 font-bold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Thẩm định viên yêu cầu khảo sát lại</span>
          </span>
        );
      case 'CONDO_FINAL_LEGAL_SEAL':
        return (
          <span className="text-indigo-700 font-bold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mã băm SHA-256 niêm phong pháp lý</span>
          </span>
        );
      case 'APPROVE_ABSENTEE_VERIFIED':
        return (
          <span className="text-violet-700 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
            <span>Biên bản thẩm định vắng chủ hộ</span>
          </span>
        );
      default:
        return (
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mật khẩu Zone Admin (Đã xác minh)</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header (Light Theme synchronized with Audit Studio) */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-sky-50/90 via-white to-slate-50 text-slate-800 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl border border-sky-200">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900">
                  Nhật Ký Kiểm Toán & Truy Vết Chỉnh Sửa
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  Append-Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hồ sơ: <strong className="text-sky-700">{reportCode || parcelCode || 'Hồ sơ khảo sát'}</strong> • Tổng cộng {logs.length} lượt can thiệp được ghi nhận
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
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
                        {/* Meta Info (Chỉ hiển thị cho các hành động chỉnh sửa hoặc phê duyệt cần lý do / xác thực) */}
                        {log.action === 'SURVEYOR_SUBMIT_REPORT' ? (
                          <div className="bg-white p-3 rounded-lg border border-teal-200 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ClipboardCheck className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="font-semibold text-teal-900">
                                Khảo sát viên <strong>{log.performedByName}</strong> đã hoàn thành biên bản và nộp hồ sơ lên hệ thống.
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              Khởi tạo ban đầu
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Nội dung / Lý do:</span>
                              <span className="text-slate-800 font-medium">
                                {log.editReason || 'Ghi nhận tiến trình theo quy chuẩn nghiệp vụ.'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Hình thức xác thực:</span>
                              {getAuthBadge(log.action)}
                            </div>
                          </div>
                        )}

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
                              {Boolean(log.rawPayload?.oldPhotoUrl) && (
                                <div className="text-center">
                                  <span className="text-[10px] text-slate-400 block mb-1">Ảnh ban đầu:</span>
                                  <img
                                    src={String(log.rawPayload?.oldPhotoUrl)}
                                    alt="Ảnh ban đầu"
                                    className="w-24 h-24 object-cover rounded border border-slate-200"
                                  />
                                </div>
                              )}
                              <span className="text-slate-400 font-bold">➜</span>
                              <div className="text-center">
                                <span className="text-[10px] text-emerald-600 font-bold block mb-1">Ảnh thay thế:</span>
                                <img
                                  src={String(log.rawPayload?.newPhotoUrl)}
                                  alt="Ảnh thay thế"
                                  className="w-24 h-24 object-cover rounded border border-emerald-300"
                                />
                              </div>
                            </div>
                          </div>
                        ) : log.action === 'SURVEYOR_SUBMIT_REPORT' ? (
                          <div className="bg-teal-50/50 p-3 rounded-lg border border-teal-200 text-xs space-y-2">
                            <span className="font-bold text-teal-800 block">Thông tin biên bản nộp ban đầu:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              {Boolean(log.rawPayload?.surveyDate) && (
                                <div className="bg-white p-2 rounded border border-teal-100">
                                  <span className="text-slate-400 block text-[10px]">Ngày khảo sát</span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {new Date(String(log.rawPayload?.surveyDate)).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                              )}
                              {log.rawPayload?.defectCount !== undefined && (
                                <div className="bg-white p-2 rounded border border-teal-100">
                                  <span className="text-slate-400 block text-[10px]">Số khuyết tật ghi nhận</span>
                                  <span className="font-bold text-slate-800">{String(log.rawPayload?.defectCount)} vết nứt/hư hại</span>
                                </div>
                              )}
                              {Boolean(log.rawPayload?.burlandCategory) && (
                                <div className="bg-white p-2 rounded border border-teal-100">
                                  <span className="text-slate-400 block text-[10px]">Cấp Burland</span>
                                  <span className="font-mono font-bold text-slate-800">{String(log.rawPayload?.burlandCategory)}</span>
                                </div>
                              )}
                              {Boolean(log.rawPayload?.status) && (
                                <div className="bg-white p-2 rounded border border-teal-100">
                                  <span className="text-slate-400 block text-[10px]">Trạng thái nộp</span>
                                  <span className="font-mono font-bold text-teal-700">{String(log.rawPayload?.status)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : log.action === 'ZONE_ADMIN_APPROVE_REPORT' ? (
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Quyết định phê duyệt chính thức</span>
                            </div>
                            {log.rawPayload?.judgementNotes ? (
                              <div className="text-emerald-950 font-medium bg-white/80 p-2 rounded border border-emerald-100">
                                <span className="text-[10px] text-emerald-700 block font-bold uppercase mb-0.5">Ý kiến / Ghi chú thẩm định:</span>
                                &ldquo;{String(log.rawPayload.judgementNotes)}&rdquo;
                              </div>
                            ) : null}
                            {log.rawPayload?.officialPdfUrl ? (
                              <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span>Hồ sơ PDF/A điện tử: </span>
                                <a
                                  href={String(log.rawPayload.officialPdfUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline font-mono text-emerald-800 hover:text-emerald-900 break-all"
                                >
                                  {String(log.rawPayload.officialPdfUrl)}
                                </a>
                              </div>
                            ) : null}
                          </div>
                        ) : log.action === 'ZONE_ADMIN_REJECT_REPORT' ? (
                          <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-200 text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800">
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Yêu cầu khảo sát lại từ Thẩm định viên</span>
                            </div>
                            <div className="text-rose-950 font-medium bg-white/80 p-2.5 rounded border border-rose-100">
                              <span className="text-[10px] text-rose-700 block font-bold uppercase mb-0.5">Lý do trả về:</span>
                              &ldquo;{String(log.rawPayload?.rejectionReason || log.editReason || 'Yêu cầu kiểm tra đo đạc lại hiện trường.')}&rdquo;
                            </div>
                          </div>
                        ) : log.action === 'CONDO_FINAL_LEGAL_SEAL' ? (
                          <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-200 text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-800">
                              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Niêm phong & Khóa sổ pháp lý toàn diện</span>
                            </div>
                            {log.rawPayload?.sealHash ? (
                              <div className="bg-white/80 p-2 rounded border border-indigo-100">
                                <span className="text-[10px] text-indigo-600 block font-bold uppercase mb-0.5">Mã băm SHA-256:</span>
                                <code className="text-[11px] font-mono text-indigo-900 break-all">{String(log.rawPayload.sealHash)}</code>
                              </div>
                            ) : null}
                            {log.rawPayload?.notes ? (
                              <div className="text-indigo-950 text-[11px]">
                                Ghi chú: {String(log.rawPayload.notes)}
                              </div>
                            ) : null}
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Tất cả các bản ghi kiểm toán đều được mã hóa và lưu trữ bất biến.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
