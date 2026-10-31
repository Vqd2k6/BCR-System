import React from 'react';

/** Dải cuộn ngang của một Vùng Z / Cấu kiện E: ảnh bối cảnh đứng đầu, các thẻ khuyết tật D nằm tiếp bên phải. */
export const AuditDefectStrip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-nowrap gap-5 overflow-x-auto pb-4 items-start scrollbar-thin">{children}</div>
);

interface AuditDefectCardShellProps {
  variant: 'zone' | 'element';
  isDeleted?: boolean;
  id?: string;
  isHighlighted?: boolean;
  children: React.ReactNode;
}

const DEFECT_CARD_WIDTH_CLASS: Record<AuditDefectCardShellProps['variant'], string> = {
  zone: 'min-w-[390px] sm:min-w-[440px] max-w-fit',
  element: 'w-fit min-w-[400px] max-w-none',
};

/** Khung thẻ khuyết tật D trong dải cuộn ngang. */
export const AuditDefectCardShell: React.FC<AuditDefectCardShellProps> = ({
  variant,
  isDeleted = false,
  id,
  isHighlighted = false,
  children,
}) => (
  <div
    id={id}
    className={`shrink-0 ${DEFECT_CARD_WIDTH_CLASS[variant]} rounded-xl border p-3.5 space-y-3 shadow-2xs transition-all ${
      isDeleted ? 'opacity-70 border-dashed border-rose-300 bg-rose-50/20' : 'bg-white border-slate-200'
    } ${isHighlighted ? 'ring-4 ring-rose-400' : ''}`}
  >
    {children}
  </div>
);

/** Dải ảnh cận cảnh CU trong thẻ khuyết tật. */
export const AuditCuPhotoStrip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-nowrap gap-3.5 pb-1">
    {React.Children.toArray(children).map((child, idx) => (
      <div key={idx} className="w-[345px] sm:w-[375px] shrink-0">
        {child}
      </div>
    ))}
  </div>
);
