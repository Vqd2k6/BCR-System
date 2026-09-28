import React from 'react';
import { Box, ShieldCheck, FileText, Info, X } from 'lucide-react';
import { ActionFeedbackMessage } from '../types';

interface Phase1ExportHeaderProps {
  user: any;
  token: string | null;
  actionMessage: ActionFeedbackMessage | null;
  onDismissActionMessage: () => void;
}

export const Phase1ExportHeader: React.FC<Phase1ExportHeaderProps> = ({
  user,
  token,
  actionMessage,
  onDismissActionMessage,
}) => {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
        <Box size={220} />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck size={13} /> ADMIN ZONE EXPORT MODULE BOX
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
              JWT Bearer Active
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <FileText className="text-sky-400 w-6 h-6" />
            <span>Phân Hệ Xuất Báo Cáo Khảo Sát Phase 1 (BCS Export Engine)</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Trích xuất dữ liệu hiện trường, thử nghiệm nạp thông tin vào template Handlebars & xuất file PDF A4 chuẩn Liên danh <strong>CRLG–CRSRI–TT</strong> kèm mã băm <strong>Checksum SHA-256</strong>.
          </p>
        </div>

        {/* User Auth Context Badge */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 flex items-center gap-3 self-start lg:self-auto min-w-[260px]">
          <div className="w-10 h-10 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center font-black text-sm">
            {user?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="text-xs overflow-hidden">
            <div className="font-bold text-white truncate">{user?.fullName || 'Zone Administrator'}</div>
            <div className="text-[11px] text-sky-200 flex items-center gap-1.5 mt-0.5">
              <span className="font-semibold text-amber-300">{user?.role || 'ZONE_ADMIN'}</span>
              <span>•</span>
              <span className="font-mono text-slate-300 truncate max-w-[120px]" title={token || ''}>
                JWT: {token ? `${token.slice(0, 10)}...` : 'Chưa đăng nhập'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {actionMessage && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : actionMessage.type === 'error'
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
              : 'bg-sky-950/70 border-sky-500/50 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info size={16} />
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={onDismissActionMessage}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
