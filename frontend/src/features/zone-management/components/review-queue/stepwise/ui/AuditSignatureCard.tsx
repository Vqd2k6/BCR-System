import React from 'react';
import { Maximize2 } from 'lucide-react';
import { AUDIT_EMPTY_VALUE } from './AuditField';

interface AuditSignatureCardProps {
  role: string;
  name?: string | null;
  note?: string | null;
  signatureUrl?: string | null;
  emptyText?: string;
  onOpenPhotoZoom: (url: string, title?: string) => void;
}

/** Thẻ chữ ký: vùng chữ ký luôn nền sáng (`.force-light`) như giấy kỹ thuật. */
export const AuditSignatureCard: React.FC<AuditSignatureCardProps> = ({
  role,
  name,
  note,
  signatureUrl,
  emptyText = 'Chưa ký',
  onOpenPhotoZoom,
}) => (
  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
    <div className="min-w-0 space-y-0.5">
      <div className="text-[11px] font-bold text-slate-500 uppercase">{role}</div>
      <div className="text-xs font-black text-slate-800 truncate">{name || AUDIT_EMPTY_VALUE}</div>
      {note && <div className="text-[11px] text-slate-500 font-mono">{note}</div>}
    </div>
    {signatureUrl ? (
      <button
        type="button"
        onClick={() => onOpenPhotoZoom(signatureUrl, `Chữ ký ${role}`)}
        className="force-light w-28 h-14 rounded-lg border border-slate-300 bg-white overflow-hidden cursor-pointer relative group shrink-0"
      >
        <img src={signatureUrl} alt={`Chữ ký ${role}`} className="w-full h-full object-contain" />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
          <Maximize2 className="w-3.5 h-3.5 text-white" />
        </div>
      </button>
    ) : (
      <span className="text-[11px] text-slate-400 italic shrink-0">{emptyText}</span>
    )}
  </div>
);
