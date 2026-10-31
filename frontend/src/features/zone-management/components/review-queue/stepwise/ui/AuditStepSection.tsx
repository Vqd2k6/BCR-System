import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AuditStepSectionProps {
  id: string;
  number: string;
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

/** Khung một bước thẩm định: cùng cấu trúc và class với các step của Nhà dân. */
export const AuditStepSection: React.FC<AuditStepSectionProps> = ({
  id,
  number,
  title,
  rightSlot,
  children,
}) => (
  <section id={id} className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
    <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
          Bước {number}
        </span>
        <h3 className="text-sm sm:text-base font-black text-slate-800">{title}</h3>
      </div>
      {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
    </div>
    <div className="p-5 space-y-6">{children}</div>
  </section>
);

interface AuditSubsectionProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

/** Tiêu đề khối con trong một bước (VD: "3.1. Hình Học Quy Mô Kiến Trúc Công Trình"). */
export const AuditSubsection: React.FC<AuditSubsectionProps> = ({ icon: Icon, title, hint, children }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-800 tracking-wider">
        {Icon && <Icon className="w-4 h-4 text-sky-600" />}
        <span>{title}</span>
      </div>
      {hint && (
        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
          {hint}
        </span>
      )}
    </div>
    {children}
  </div>
);
