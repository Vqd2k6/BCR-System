import React, { useState } from 'react';
import { DraftingCompass } from 'lucide-react';
import { CadLabModal } from './CadLabModal';

interface Props {
  /** dark-nav: thanh điều hướng nền tối của Super Admin; light-bar: thanh trên nền sáng của Zone Admin. */
  variant: 'dark-nav' | 'light-bar';
}

const VARIANT_CLASS: Record<Props['variant'], string> = {
  'dark-nav':
    'ml-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 transition-all cursor-pointer active:scale-95',
  'light-bar':
    'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-all cursor-pointer active:scale-95 shadow-2xs',
};

/** Nút tự quản lý việc mở CAD Lab; gắn một dòng vào thanh công cụ. */
export const CadLabLauncher: React.FC<Props> = ({ variant }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer ${VARIANT_CLASS[variant]}`}
        title="Mở CAD Lab: chuyển ảnh phác thảo tay thành bản vẽ kỹ thuật SVG / PNG / DXF"
      >
        <DraftingCompass size={15} />
        <span>CAD Lab (Vẽ tay → CAD)</span>
      </button>
      <CadLabModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
